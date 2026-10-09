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
    years = sorted(int(p.stem) for p in data_dir.glob("20[0-9][0-9].json"))
    manifest = json.loads((data_dir / "seasons.json").read_text())
    if manifest != {"years": years} or not years:
        raise ValueError("Invalid season index: publication aborted")
    prior = old_catalog or {}
    if prior and (prior.get("schema") != 1 or
                  not isinstance(prior.get("files"), dict)):
        raise ValueError("Unrecognized remote catalog; cannot safely overwrite")
    # Never drop a historical season from the remote catalog.
    prior_years = prior.get("years", [])
    if not set(prior_years).issubset(years):
        raise ValueError("Season history regression; refusing to drop older years")

    objects = {}
    uploads = []
    files = {}
    for year in years:
        d = json.loads((data_dir / f"{year}.json").read_text())
        if d.get("year") != year or d.get("schema") != 3 or len(d.get("players", [])) < 100:
            raise ValueError(f"Invalid research snapshot for {year}")
        hexdigest = digest(d)
        key = f"{PREFIX}/objects/{year}-{hexdigest}.json"
        prior_file = prior.get("files", {}).get(str(year), {})
        if (prior_file.get("sha256") == hexdigest and
                prior_file.get("key") == key):
            files[str(year)] = prior_file
        else:
            raw = (json.dumps(d, separators=(",", ":"), ensure_ascii=False)
                   + "\n").encode("utf-8")
            uploads.append((key, raw))
            files[str(year)] = {
                "key": key,
                "sha256": hexdigest,
                "throughWeek": d["throughWeek"],
                "updated": d["updated"],
            }
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
        raise RuntimeError(
            f"Public Worker returned HTTP {error.code} for {key}; "
            f"server={server}, cf-ray={cf_ray}, cf-mitigated={mitigation}; "
            f"response-prefix={body!r}. Inspect Worker/Cloudflare access "
            "rules and confirm this URL works in a private browser session."
        ) from error
    except URLError as error:
        raise RuntimeError(f"Public R2 URL not reachable: {key}") from error
    if expected_sha:
        parsed = json.loads(body)
        if digest(parsed) != expected_sha:
            raise RuntimeError(f"Public R2 object differs from uploaded source: {key}")
    return body


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
    # A verified HTTPS Cloudflare Worker (workers.dev or custom domain) must serve the bucket with CORS.
    # Verify at least the newly written version before changing the pointer.
    for year in catalog["years"]:
        info = catalog["files"][str(year)]
        if any(key == info["key"] for key, _ in uploads):
            public_check(base, info["key"], info["sha256"])

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
