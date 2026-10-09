#!/usr/bin/env python3
"""Validate optional red-zone snapshots against their base season files.

Red-zone files live at public/research/data/redzone/{season}.json and are
never published unless every check here passes (see build-research-redzone.py).
Player rows list only player-weeks with at least one red-zone event; a base
player-week without a row means zero, provided its team-week row exists.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

REDZONE_SCHEMA = 1
PLAYER_FIELDS = ["week", "team", "rzCar", "i10Car", "i5Car", "rzRuTd", "i10RuTd", "i5RuTd",
                 "rzTgt", "i10Tgt", "i5Tgt", "rzRec", "rzReTd", "i10ReTd", "i5ReTd", "rzAtt", "i5Att", "rzPaTd"]
TEAM_FIELDS = ["week", "rzCar", "i10Car", "i5Car", "rzTgt", "i10Tgt", "i5Tgt"]
SKILL = {"QB", "RB", "WR", "TE"}
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "research" / "data"
# Base weekly row indexes (scripts/build-nflverse-research.py schema 3).
BASE = {"rec": 3, "tgt": 4, "car": 6, "pptd": 9, "rut": 13, "rt": 14}
# (smaller, larger): smaller can never exceed larger.
NESTED = [("i5Car", "i10Car"), ("i10Car", "rzCar"), ("i5RuTd", "i10RuTd"), ("i10RuTd", "rzRuTd"),
          ("i5Tgt", "i10Tgt"), ("i10Tgt", "rzTgt"), ("i5ReTd", "i10ReTd"), ("i10ReTd", "rzReTd"),
          ("rzRuTd", "rzCar"), ("i10RuTd", "i10Car"), ("i5RuTd", "i5Car"), ("rzRec", "rzTgt"),
          ("rzReTd", "rzRec"), ("i10ReTd", "i10Tgt"), ("i5ReTd", "i5Tgt"), ("i5Att", "rzAtt"), ("rzPaTd", "rzAtt")]
TEAM_NESTED = [("i5Car", "i10Car"), ("i10Car", "rzCar"), ("i5Tgt", "i10Tgt"), ("i10Tgt", "rzTgt")]
BASE_CAP = [("rzCar", "car"), ("rzTgt", "tgt"), ("rzRec", "rec"), ("rzRuTd", "rut"), ("rzReTd", "rt"), ("rzPaTd", "pptd")]


def count(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def validate_redzone(rz: dict, base: dict) -> list[str]:
    errors: list[str] = []
    err = errors.append
    if rz.get("schema") != REDZONE_SCHEMA:
        err(f"schema {rz.get('schema')} != {REDZONE_SCHEMA}")
    if rz.get("year") != base.get("year"):
        err("year does not match base season")
    if rz.get("throughWeek") != base.get("throughWeek"):
        err("throughWeek does not match base season")
    if rz.get("fields") != {"player": PLAYER_FIELDS, "team": TEAM_FIELDS}:
        err("field contract changed")
    for key in ("source", "sourceUrl", "license", "updated", "rules"):
        if not rz.get(key):
            err(f"missing metadata {key}")
    through = base.get("throughWeek", 0)
    teams: dict[tuple[str, int], dict] = {}
    for team, rows in (rz.get("teams") or {}).items():
        for row in rows:
            if len(row) != len(TEAM_FIELDS) or not all(count(v) for v in row):
                err(f"bad team row {team} {row}")
                continue
            t = dict(zip(TEAM_FIELDS, row))
            if (team, t["week"]) in teams:
                err(f"duplicate team week {team} {t['week']}")
            if not 1 <= t["week"] <= through:
                err(f"team week outside 1..{through}: {team} {t['week']}")
            for a, b in TEAM_NESTED:
                if t[a] > t[b]:
                    err(f"team {team} week {t['week']}: {a} > {b}")
            teams[(team, t["week"])] = t
    base_rows = {}
    for p in base.get("players", []):
        if p.get("pos") in SKILL:
            for w in p["w"]:
                base_rows[(p["id"], w[0])] = w
                if (w[1], w[0]) not in teams:
                    err(f"{p['id']} week {w[0]}: no team-week row for {w[1]}")
    sums: dict[tuple[str, int], list[int]] = defaultdict(lambda: [0] * 6)
    for pid, rows in (rz.get("players") or {}).items():
        weeks = [r[0] for r in rows]
        if weeks != sorted(set(weeks)):
            err(f"{pid}: weeks not unique and ascending")
        for r in rows:
            if len(r) != len(PLAYER_FIELDS) or not isinstance(r[1], str) or not all(count(v) for v in [r[0]] + r[2:]):
                err(f"{pid}: malformed row {r}")
                continue
            x = dict(zip(PLAYER_FIELDS, r))
            b = base_rows.get((pid, x["week"]))
            if b is None:
                err(f"{pid} week {x['week']}: no matching base skill row (unplayed or unknown player-week)")
                continue
            if b[1] != x["team"]:
                err(f"{pid} week {x['week']}: team {x['team']} != base {b[1]}")
            if not any(r[2:]):
                err(f"{pid} week {x['week']}: all-zero row should be omitted")
            for a, c in NESTED:
                if x[a] > x[c]:
                    err(f"{pid} week {x['week']}: {a} {x[a]} > {c} {x[c]}")
            for a, c in BASE_CAP:
                if x[a] > b[BASE[c]]:
                    err(f"{pid} week {x['week']}: {a} {x[a]} exceeds full-game {c} {b[BASE[c]]}")
            s = sums[(x["team"], x["week"])]
            for i, f in enumerate(TEAM_FIELDS[1:]):
                s[i] += x[f]
    for key, s in sums.items():
        t = teams.get(key)
        if t is None:
            err(f"{key}: no team denominator")
        elif any(v > t[f] for v, f in zip(s, TEAM_FIELDS[1:])):
            err(f"{key}: player totals exceed team red-zone totals")
    return errors


def main() -> int:
    manifest_path = DATA / "redzone" / "seasons.json"
    if not manifest_path.exists():
        print("No red-zone manifest; red-zone data is optional. Nothing to validate.")
        return 0
    manifest = json.loads(manifest_path.read_text())
    failed = False
    if manifest.get("schema") != REDZONE_SCHEMA or manifest.get("years") != sorted(set(manifest.get("years", []))):
        print("FAIL red-zone manifest"); failed = True
    for year in manifest.get("years", []):
        rz = json.loads((DATA / "redzone" / f"{year}.json").read_text())
        base = json.loads((DATA / f"{year}.json").read_text())
        errors = validate_redzone(rz, base)
        if errors:
            failed = True
            print(f"FAIL red zone {year}: {len(errors)} problems"); [print("  " + e) for e in errors[:20]]
        else:
            print(f"PASS red zone {year}: {len(rz['players'])} players, {len(rz['teams'])} teams, through week {rz['throughWeek']}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
