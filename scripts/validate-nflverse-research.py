#!/usr/bin/env python3
"""Fail-closed verification of LeagueZone's static nflverse research snapshots."""
import json
import math
import sys
from collections import Counter
from pathlib import Path

DATA = Path("public/research/data")
YEARS = [2023, 2024, 2025, 2026]


def get_player(players, name):
    match = [p for p in players if p["n"] == name]
    if len(match) != 1:
        raise AssertionError(f"Expected exactly one {name}, got {len(match)}")
    return match[0]


def verify(year):
    snapshot = json.loads((DATA / f"{year}.json").read_text())
    assert snapshot["year"] == year
    assert snapshot["source"].startswith("nflverse/"), (year, snapshot.get("source"))
    assert snapshot["schema"] == 2
    assert 1 <= snapshot["throughWeek"] <= 18
    if year < 2026:
        assert snapshot["throughWeek"] == 18, year
    if year == 2026:
        assert snapshot["throughWeek"] >= 4, year
    players = snapshot["players"]
    assert len(players) >= 425, (year, len(players))
    ids = [p["id"] for p in players]
    assert len(ids) == len(set(ids)), f"Duplicate IDs {year}"
    positions = Counter(p["pos"] for p in players)
    for position, min_expected in (("QB", 40), ("RB", 80), ("WR", 120),
                                   ("TE", 70), ("K", 25), ("DEF", 32)):
        assert positions[position] >= min_expected, (year, position, positions[position])
    week_pos = {}
    for p in players:
        assert p["g"] == len(p["w"]) > 0, (year, p["n"])
        weeks = [row[0] for row in p["w"]]
        assert weeks == sorted(set(weeks)), (year, p["n"], weeks)
        assert all(1 <= w <= snapshot["throughWeek"] for w in weeks), (year, p["n"])
        assert math.isfinite(p["p"]), (year, p["n"])
        assert abs(p["p"] - sum(row[2] for row in p["w"])) < 0.025, (year, p["n"])
        for row in p["w"]:
            assert len(row) >= 13 and math.isfinite(row[2]), (year, p["n"], row)
            week_pos.setdefault(row[0], Counter())[p["pos"]] += 1
    for week in range(1, snapshot["throughWeek"] + 1):
        counts = week_pos.get(week, Counter())
        assert counts["QB"] >= 20, (year, week, "QB", counts["QB"])
        assert counts["WR"] >= 75, (year, week, "WR", counts["WR"])
        assert counts["K"] >= 20, (year, week, "K", counts["K"])
        assert counts["DEF"] >= 24, (year, week, "DEF", counts["DEF"])
    assert sum(get_player(players, "Brandon Aubrey")["w"][0][2:3]) > 0, year
    if year == 2024:
        adams = get_player(players, "Davante Adams")
        assert 1 in {w[0] for w in adams["w"]}, "Traded player's earlier games missing"
        assert adams["g"] >= 13, adams
    if year == 2025:
        chase = get_player(players, "Ja'Marr Chase")
        brown = get_player(players, "Chase Brown")
        for p in (chase, brown):
            assert {1, 2, 3, 4}.issubset({w[0] for w in p["w"]}), p["n"]
        assert chase["p"] > 280 and brown["p"] > 250, (chase["p"], brown["p"])
    print(f"PASS {year}: {len(players)} entries, {snapshot['throughWeek']} weeks, "
          f"{dict(positions)}, all game logs and spot-checks valid", flush=True)


if __name__ == "__main__":
    requested = [int(x) for x in sys.argv[1:]] if len(sys.argv) > 1 else YEARS
    for year in requested:
        verify(year)
