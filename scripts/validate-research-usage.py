#!/usr/bin/env python3
"""Validate optional advanced-usage snapshots against their base season files.

Usage files live at public/research/data/usage/{season}.json and are never
published unless every check here passes (see build-research-usage.py).
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

USAGE_SCHEMA = 1
PLAYER_FIELDS = ["week", "team", "att", "cmp", "pyd", "car", "tgt", "rec", "ay", "yac"]
TEAM_FIELDS = ["week", "att", "car", "tgt", "ay"]
SKILL = {"QB", "RB", "WR", "TE"}
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "research" / "data"
# Base weekly row indexes (scripts/build-nflverse-research.py schema 3).
BASE = {"rec": 3, "tgt": 4, "car": 6, "pyd": 8}


def finite(value) -> bool:
    return value is None or (isinstance(value, (int, float)) and math.isfinite(value))


def validate_usage(usage: dict, base: dict) -> list[str]:
    errors: list[str] = []
    err = errors.append
    if usage.get("schema") != USAGE_SCHEMA:
        err(f"schema {usage.get('schema')} != {USAGE_SCHEMA}")
    if usage.get("year") != base.get("year"):
        err("year does not match base season")
    if usage.get("throughWeek") != base.get("throughWeek"):
        err("throughWeek does not match base season")
    if usage.get("baseUpdated") != base.get("updated"):
        err("baseUpdated does not match base season version")
    if usage.get("fields") != {"player": PLAYER_FIELDS, "team": TEAM_FIELDS}:
        err("field contract changed")
    for key in ("source", "sourceUrl", "license", "updated"):
        if not usage.get(key):
            err(f"missing metadata {key}")
    through = base.get("throughWeek", 0)
    teams: dict[tuple[str, int], list] = {}
    for team, rows in (usage.get("teams") or {}).items():
        for row in rows:
            if len(row) != len(TEAM_FIELDS) or not all(finite(v) and v is not None for v in row):
                err(f"bad team row {team} {row}")
                continue
            if (team, row[0]) in teams:
                err(f"duplicate team week {team} {row[0]}")
            if not 1 <= row[0] <= through:
                err(f"team week outside 1..{through}: {team} {row[0]}")
            teams[(team, row[0])] = row
    base_rows = {}
    for p in base.get("players", []):
        if p.get("pos") in SKILL:
            for w in p["w"]:
                base_rows[(p["id"], w[0])] = w
    sums: dict[tuple[str, int], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    seen = set()
    for pid, rows in (usage.get("players") or {}).items():
        weeks = [r[0] for r in rows]
        if weeks != sorted(set(weeks)):
            err(f"{pid}: weeks not unique and ascending")
        for r in rows:
            if len(r) != len(PLAYER_FIELDS) or not all(finite(v) for v in r[2:]):
                err(f"{pid}: malformed or non-finite row {r}")
                continue
            week, team = r[0], r[1]
            b = base_rows.get((pid, week))
            if b is None:
                err(f"{pid} week {week}: no matching base row (unplayed or unknown player-week)")
                continue
            seen.add((pid, week))
            if b[1] != team:
                err(f"{pid} week {week}: team {team} != base {b[1]}")
            for i, key in enumerate(PLAYER_FIELDS):
                if key in BASE and r[i] is not None and abs(r[i] - b[BASE[key]]) > 1e-6:
                    err(f"{pid} week {week}: {key} {r[i]} does not reconcile with base {b[BASE[key]]}")
            att, cmp = r[2], r[3]
            if att is not None and cmp is not None and not 0 <= cmp <= att:
                err(f"{pid} week {week}: completions {cmp} outside 0..attempts {att}")
            if any(r[i] is not None and r[i] < 0 for i in (2, 3, 5, 6, 7)):
                err(f"{pid} week {week}: negative count")
            t = teams.get((team, week))
            if t is None:
                err(f"{pid} week {week}: no team denominator for {team}")
                continue
            s = sums[(team, week)]
            s[0] += r[2] or 0; s[1] += r[5] or 0; s[2] += r[6] or 0
    for key in base_rows.keys() - seen:
        err(f"base player-week {key} has no usage row")
    for key, (att, car, tgt) in sums.items():
        t = teams[key]
        if att > t[1] + 1e-6 or car > t[2] + 1e-6 or tgt > t[3] + 1e-6:
            err(f"{key}: player totals exceed team denominators")
    return errors


def main() -> int:
    manifest_path = DATA / "usage" / "seasons.json"
    if not manifest_path.exists():
        print("No usage manifest; advanced usage is optional. Nothing to validate.")
        return 0
    manifest = json.loads(manifest_path.read_text())
    failed = False
    if manifest.get("schema") != USAGE_SCHEMA or manifest.get("years") != sorted(set(manifest.get("years", []))):
        print("FAIL usage manifest"); failed = True
    for year in manifest.get("years", []):
        usage = json.loads((DATA / "usage" / f"{year}.json").read_text())
        base = json.loads((DATA / f"{year}.json").read_text())
        errors = validate_usage(usage, base)
        if errors:
            failed = True
            print(f"FAIL usage {year}: {len(errors)} problems"); [print("  " + e) for e in errors[:20]]
        else:
            print(f"PASS usage {year}: {len(usage['players'])} players, {len(usage['teams'])} teams, through week {usage['throughWeek']}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
