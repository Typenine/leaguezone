#!/usr/bin/env python3
"""Build LeagueZone's optional advanced-usage snapshots from nflverse.

Writes public/research/data/usage/{season}.json next to (never over) the base
season files from build-nflverse-research.py. Same source and conventions:
nflreadpy weekly player and team stats, regular season only, offline on
GitHub Actions or a developer machine. No Neon, credentials or visitor calls.
A season is published only if it validates against its base season file.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "research" / "data"
_spec = importlib.util.spec_from_file_location("usage_validator", ROOT / "scripts" / "validate-research-usage.py")
validator = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(validator)
PLAYER_FIELDS, TEAM_FIELDS, SKILL = validator.PLAYER_FIELDS, validator.TEAM_FIELDS, validator.SKILL
# nflverse column for each published field. Shares are computed in the browser
# from these numerators and the team denominators, so season shares are
# weighted sums rather than averages of weekly percentages.
PLAYER_SOURCE = {"att": "attempts", "cmp": "completions", "pyd": "passing_yards", "car": "carries",
                 "tgt": "targets", "rec": "receptions", "ay": "receiving_air_yards",
                 "yac": "receiving_yards_after_catch"}
TEAM_SOURCE = {"att": "attempts", "car": "carries", "tgt": "targets", "ay": "receiving_air_yards"}


def value(row: dict, key: str):
    raw = row.get(key)
    if raw is None:
        return None  # Published as null: unavailable, never zero.
    raw = float(raw)
    if not math.isfinite(raw):
        raise ValueError(f"Non-finite {key} in {row.get('player_id') or row.get('team')} week {row.get('week')}")
    return int(raw) if raw.is_integer() else round(raw, 2)


def build_usage(season: int, stats: list[dict], teams: list[dict], base: dict, stamp: str) -> dict:
    through = int(base["throughWeek"])
    wanted = {(p["id"], w[0]): w[1] for p in base["players"] if p["pos"] in SKILL for w in p["w"]}
    players: dict[str, list] = {}
    seen = set()
    for row in stats:
        if row.get("season_type") != "REG" or int(row.get("week") or 0) > through:
            continue
        key = (row.get("player_id"), int(row["week"]))
        if key not in wanted:
            continue
        if key in seen:
            raise ValueError(f"Duplicate player-week {key}")
        seen.add(key)
        if row.get("team") != wanted[key]:
            raise ValueError(f"Team mismatch for {key}: {row.get('team')} vs base {wanted[key]}")
        players.setdefault(key[0], []).append(
            [key[1], row["team"]] + [value(row, PLAYER_SOURCE[f]) for f in PLAYER_FIELDS[2:]])
    team_rows: dict[str, list] = {}
    for row in teams:
        if row.get("season_type") != "REG" or int(row.get("week") or 0) > through:
            continue
        team_rows.setdefault(row["team"], []).append(
            [int(row["week"])] + [value(row, TEAM_SOURCE[f]) for f in TEAM_FIELDS[1:]])
    return {
        "year": season, "schema": validator.USAGE_SCHEMA, "throughWeek": through,
        "baseUpdated": base.get("updated"), "updated": stamp,
        "source": "nflverse/nflverse-data weekly player and team statistics (regular season)",
        "sourceUrl": "https://github.com/nflverse/nflverse-data/releases",
        "license": "CC BY 4.0 (subject to underlying source rights)",
        "fields": {"player": PLAYER_FIELDS, "team": TEAM_FIELDS},
        "teams": {t: sorted(r) for t, r in sorted(team_rows.items())},
        "players": {pid: sorted(r) for pid, r in sorted(players.items())},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+", type=int, required=True)
    args = parser.parse_args()
    import nflreadpy as nfl
    stamp = datetime.now(timezone.utc).date().isoformat()
    out = DEST / "usage"
    pending = []
    for season in args.seasons:
        base_path = DEST / f"{season}.json"
        if not base_path.exists():
            raise SystemExit(f"No base season file for {season}; build it first")
        base = json.loads(base_path.read_text())
        stats = nfl.load_player_stats(season, summary_level="week").to_dicts()
        teams = nfl.load_team_stats(season, summary_level="week").to_dicts()
        usage = build_usage(season, stats, teams, base, stamp)
        errors = validator.validate_usage(usage, base)
        if errors:
            raise SystemExit(f"Usage {season} failed validation; nothing published:\n  " + "\n  ".join(errors[:20]))
        path = out / f"{season}.json"
        old = json.loads(path.read_text()) if path.exists() else None
        if old and old.get("throughWeek", 0) > usage["throughWeek"]:
            raise SystemExit(f"Usage {season} would regress from week {old['throughWeek']}; keeping previous file")
        if old and {k: v for k, v in old.items() if k != "updated"} == {k: v for k, v in usage.items() if k != "updated"}:
            usage["updated"] = old["updated"]
        pending.append((path, usage))
        print(f"Validated usage {season}: {len(usage['players'])} players through week {usage['throughWeek']}", flush=True)
    # Publish only after every requested season passed, then the manifest last.
    out.mkdir(parents=True, exist_ok=True)
    for path, usage in pending:
        text = json.dumps(usage, separators=(",", ":"), ensure_ascii=False) + "\n"
        if path.exists() and path.read_text() == text:
            continue
        tmp = path.with_suffix(".tmp")
        tmp.write_text(text)
        os.replace(tmp, path)
    years = sorted({int(p.stem) for p in out.glob("20[0-9][0-9].json")})
    manifest = json.dumps({"schema": validator.USAGE_SCHEMA, "years": years}, separators=(",", ":")) + "\n"
    mpath = out / "seasons.json"
    if not mpath.exists() or mpath.read_text() != manifest:
        tmp = mpath.with_suffix(".tmp")
        tmp.write_text(manifest)
        os.replace(tmp, mpath)


if __name__ == "__main__":
    main()
