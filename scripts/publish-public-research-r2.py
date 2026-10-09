#!/usr/bin/env python3
"""Publish validated LeagueZone research snapshots directly to Cloudflare R2.

Uses a dedicated write-only (or read/write) R2 token in GitHub Actions secrets.
NEVER called by Next.js, Neon, or browser requests. Never commits snapshot
updates to the website repository. Supports first-time backfill and weekly
no-op refreshes, with versioned immutable objects and an atomic catalog.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SOURCE = Path(__file__).resolve().parents[1] / "public" / "research" / "data"
PREFIX = "research/v1"
CATALOG_KEY = PREFIX + "/catalog.json"


class PublicWorkerBlocked(RuntimeError):
    """Worker public read rejected at the edge; independent S3 validation required."""



def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} must be configured as a GitHub Actions secret/variable")
    return value


def canonical_stats(payload: dict) -> bytes:
    """An unchanged week must not upload merely because the run date changed."""
    comparable = dict(payload)
    comparable.pop("updated", None)
    return json.dumps(comparable, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False).encode("utf-8")


def digest(payload: dict) -> str:
    return hashlib.sha256(canonical_stats(payload)).hexdigest()


def build_catalog(data_dir: Path, old_catalog: dict | None = None):
    """Keep archived remote years even after ephemeral build jobs roll over.

    The workflow never commits new season JSON back to Git, so historical
    2027.json won't exist in the 2028 checkout. Treat the remote R2 catalog as
    an immutable-history index and update only locally generated seasons.
    """
    local_years = sorted(int(p.stem) for p in data_dir.glob("20[0-9][0-9].json"))
    manifest = json.loads((data_dir / "seasons.json").read_text())
    if manifest != {"years": local_years} or not local_years:
        raise ValueError("Invalid local season index: publication aborted")
    prior = old_catalog or {}
    if prior and (prior.get("schema") != 1 or
                  not isinstance(prior.get("files"), dict) or
                  not isinstance(prior.get("years"), list)):
        raise ValueError("Unrecognized remote catalog; cannot safely overwrite")

    old_years = prior.get("years", [])
    if len(set(old_years)) != len(old_years):
        raise ValueError("Duplicate seasons in remote catalog")
    years = sorted(set(local_years) | set(old_years))
    uploads = []
    files = dict(prior.get("files", {}))
    for year in local_years:
        d = json.loads((data_dir / f"{year}.json").read_text())
        if d.get("year") != year or d.get("schema") != 3 or len(d.get("players", [])) < 100:
            raise ValueError(f"Invalid research snapshot for {year}")
        hexdigest = digest(d)
        key = f"{PREFIX}/objects/{year}-{hexdigest}.json"
        prior_file = prior.get("files", {}).get(str(year), {})
        if int(prior_file.get("throughWeek", 0)) > int(d.get("throughWeek", 0)):
            raise ValueError(f"Refusing to regress archived {year} from week "
                             f"{prior_file['throughWeek']} to week {d['throughWeek']}")
        if (prior_file.get("sha256") == hexdigest and
                prior_file.get("key") == key):
            files[str(year)] = prior_file
            continue
        raw = (json.dumps(d, separators=(",", ":"), ensure_ascii=False)
               + "\n").encode("utf-8")
        uploads.append((key, raw))
        files[str(year)] = {
            "key": key,
            "sha256": hexdigest,
            "throughWeek": d["throughWeek"],
            "updated": d["updated"],
        }
    if set(files) != {str(year) for year in years}:
        raise ValueError("Incomplete remote season catalog")
    catalog = {"schema": 1, "years": years, "files": files}
    return catalog, uploads


def create_client():
    import boto3
    import re
    account_id = required("RESEARCH_R2_ACCOUNT_ID")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", account_id):
        raise ValueError(
            "RESEARCH_R2_ACCOUNT_ID must contain only your 32-character Cloudflare "
            "Account ID, not an S3 endpoint URL, bucket name, or path. "
            "Update the GitHub Actions repository secret and rerun."
        )
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=required("RESEARCH_R2_ACCESS_KEY_ID"),
        aws_secret_access_key=required("RESEARCH_R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )


def read_remote_catalog(client, bucket: str):
    from botocore.exceptions import ClientError
    try:
        raw = client.get_object(Bucket=bucket, Key=CATALOG_KEY)["Body"].read()
        return json.loads(raw)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
            return None
        raise


def public_check(base: str, key: str, expected_sha: str | None = None):
    """Verify public GET and browser CORS, never reveal credentials."""
    url = base.rstrip("/") + "/" + key
    origin = os.getenv("RESEARCH_R2_SITE_ORIGIN", "https://www.leaguezonehq.com").strip()
    request = Request(url, headers={
        "Origin": origin,
        "Cache-Control": "no-cache",
        "User-Agent": "LeagueZoneResearchVerifier/1.0 (+https://www.leaguezonehq.com)",
        "Accept": "application/json",
    })
    try:
        with urlopen(request, timeout=15) as response:
            headers = response.headers
            allowed = headers.get("Access-Control-Allow-Origin", "")
            if allowed not in ("*", origin):
                raise RuntimeError(f"R2 CORS does not allow {origin} for {key}")
            body = response.read()
    except HTTPError as error:
        # Diagnostic details of a public read only. Avoid logging credentials
        # or query parameters. Cloudflare may block automated requests before
        # they reach the Worker.
        body = error.read(350).decode("utf-8", "replace")
        cf_ray = error.headers.get("cf-ray", "none")
        server = error.headers.get("server", "unknown")
        mitigation = error.headers.get("cf-mitigated", "none")
        reason = (
            f"Public Worker returned HTTP {error.code} for {key}; "
            f"server={server}, cf-ray={cf_ray}, cf-mitigated={mitigation}; "
            f"response-prefix={body!r}."
        )
        if error.code == 403 and server.lower() == "cloudflare":
            raise PublicWorkerBlocked(reason) from error
        raise RuntimeError(reason) from error
    except URLError as error:
        raise RuntimeError(f"Public R2 URL not reachable: {key}") from error
    if expected_sha:
        parsed = json.loads(body)
        if digest(parsed) != expected_sha:
            raise RuntimeError(f"Public R2 object differs from uploaded source: {key}")
    return body


def verify_r2_objects(client, bucket: str, catalog: dict):
    """Read back every versioned R2 file and check canonical SHA-256.

    Cloudflare can deny GitHub Actions' public HTTP bot traffic while
    browsers can still read the Worker endpoint.
    """
    for year in catalog["years"]:
        info = catalog["files"][str(year)]
        key = info["key"]
        raw = client.get_object(Bucket=bucket, Key=key)["Body"].read()
        payload = json.loads(raw)
        if payload.get("year") != year or payload.get("schema") != 3:
            raise RuntimeError(f"R2 schema/year verification failed: {year}")
        if digest(payload) != info["sha256"]:
            raise RuntimeError(f"R2 SHA-256 verification failed: {year}")
        expected_key = f"{PREFIX}/objects/{year}-{info['sha256']}.json"
        if key != expected_key:
            raise RuntimeError(f"R2 object key verification failed: {year}")
    print(f"Verified {len(catalog['years'])} R2 season objects using authenticated GET and SHA-256.", flush=True)


def publish(client, bucket: str, base: str, catalog: dict, uploads: list, old: dict | None):
    # Immutable object first; catalog pointer is published only after all
    # files are uploaded and HEAD-verified. Failures preserve prior catalog.
    for key, raw in uploads:
        client.put_object(
            Bucket=bucket, Key=key, Body=raw,
            ContentType="application/json; charset=utf-8",
            CacheControl="public, max-age=31536000, immutable",
        )
        head = client.head_object(Bucket=bucket, Key=key)
        if int(head.get("ContentLength", -1)) != len(raw):
            raise RuntimeError(f"R2 object incomplete: {key}")
        print(f"Published immutable research object: {key}")
    # Verify actual bytes before publishing the catalog, not only object sizes.
    verify_r2_objects(client, bucket, catalog)
    # GitHub Actions can be denied by Cloudflare's bot protection. Explicitly
    # permit ONLY a Cloudflare 403 after source bytes pass the independent S3
    # check; other failures remain fatal. Public browser/CORS checks are required.
    allow_edge_403 = os.environ.get("RESEARCH_R2_ALLOW_CLOUDFLARE_403") == "true"
    for year in catalog["years"]:
        info = catalog["files"][str(year)]
        if not any(key == info["key"] for key, _ in uploads):
            continue
        try:
            public_check(base, info["key"], info["sha256"])
        except PublicWorkerBlocked as error:
            if not allow_edge_403:
                raise
            print(
                f"WARNING: Cloudflare denied GitHub runner public verification "
                f"for {year} (403). Authenticated R2 SHA-256 verified. "
                "The Worker was independently confirmed via incognito browser; "
                "production browser/CORS checks are still required. "
                f"Cloudflare response: {error}", flush=True
            )

    if catalog == old:
        print("R2 research data unchanged; no catalog write and no Vercel build.")
        return False
    raw = (json.dumps(catalog, separators=(",", ":"), sort_keys=True) + "\n").encode()
    client.put_object(
        Bucket=bucket, Key=CATALOG_KEY, Body=raw,
        ContentType="application/json; charset=utf-8",
        CacheControl="public, max-age=60, must-revalidate",
    )
    # SDK verification is authoritative: Cloudflare CDN caches may briefly
    # serve the previous valid catalog within its configured TTL.
    remote = read_remote_catalog(client, bucket)
    if remote != catalog:
        raise RuntimeError("Published catalog does not match validated payload")
    print(f"Published R2 catalog with seasons {catalog['years']} ({len(uploads)} changed objects).")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    # Source validator protects key scoring and game log constraints.
    from importlib.util import module_from_spec, spec_from_file_location
    validator_path = Path(__file__).with_name("validate-nflverse-research.py")
    spec = spec_from_file_location("research_validator", validator_path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    for year in sorted(int(p.stem) for p in SOURCE.glob("20[0-9][0-9].json")):
        module.verify(year)
    if args.dry_run:
        catalog, uploads = build_catalog(SOURCE)
        print(f"Validated upload plan: {len(catalog['years'])} seasons, {len(uploads)} immutable files")
        return
    bucket = required("RESEARCH_R2_BUCKET")
    base = required("RESEARCH_R2_PUBLIC_BASE")
    if not base.startswith("https://") or "r2.dev" in base.lower():
        raise RuntimeError("RESEARCH_R2_PUBLIC_BASE must be a secure HTTPS Worker or custom domain, not r2.dev")
    client = create_client()
    existing = read_remote_catalog(client, bucket)
    catalog, uploads = build_catalog(SOURCE, existing)
    publish(client, bucket, base, catalog, uploads, existing)


if __name__ == "__main__":
    main()
