#!/usr/bin/env python3
"""Fail-closed verification of all published, database-free NFL snapshots."""
import json
import math
import sys
from collections import Counter
from pathlib import Path

DATA = Path("public/research/data")
YEARS = sorted(int(p.stem) for p in DATA.glob("20[0-9][0-9].json"))


def get_player(players, name):
    matches = [p for p in players if p["n"] == name]
    if len(matches) != 1:
        raise AssertionError(f"Expected exactly one {name}; found {len(matches)}")
    return matches[0]


def verify(year):
    d = json.loads((DATA / f"{year}.json").read_text())
    assert d["year"] == year
    assert d["source"].startswith("nflverse/"), (year, d.get("source"))
    assert d["schema"] == 3, (year, d.get("schema"))
    assert 1 <= d["throughWeek"] <= 18
    if year < 2026:
        assert d["throughWeek"] == 18
    if year == 2026:
        assert d["throughWeek"] >= 4
    players = d["players"]
    assert len(players) >= 425, (year, len(players))
    ids = [p["id"] for p in players]
    assert len(ids) == len(set(ids)), f"Duplicate IDs {year}"
    counts = Counter(p["pos"] for p in players)
    for position, minimum in [("QB",40),("RB",80),("WR",120),
                               ("TE",70),("K",25),("DEF",32)]:
        assert counts[position] >= minimum, (year, position, counts[position])
    weeks = {}
    for p in players:
        assert p["g"] == len(p["w"]) > 0, (year,p["n"])
        assert "ryr" in p, (year,p["n"])
        if p["ryr"] is not None:
            assert 1920 <= p["ryr"] <= year, (year,p["n"],p["ryr"])
        indices = [w[0] for w in p["w"]]
        assert indices == sorted(set(indices)), (year,p["n"],indices)
        assert all(1 <= w <= d["throughWeek"] for w in indices)
        assert math.isfinite(p["p"]) and abs(p["p"]-sum(w[2] for w in p["w"])) < .025
        for w in p["w"]:
            assert len(w) >= (17 if p["pos"]=="DEF" else 15), (year,p["n"],w)
            assert math.isfinite(w[2])
            if p["pos"]=="QB" and len(w)>15:
                assert isinstance(w[15],int) and w[15]>=0, (year,p["n"],w)
            weeks.setdefault(w[0],Counter())[p["pos"]]+=1
    for week in range(1,d["throughWeek"]+1):
        counts=weeks.get(week,Counter())
        for pos,min_count in (("QB",20),("WR",75),("K",20),("DEF",24)):
            assert counts[pos]>=min_count, (year,week,pos,counts[pos])
    assert get_player(players,"Brandon Aubrey")["w"][0][2]>0
    rookies=[p for p in players if p["ryr"]==year]
    assert len(rookies)>=10, (year,"missing rookie metadata",len(rookies))
    if year==2024:
        adams=get_player(players,"Davante Adams")
        assert 1 in {w[0] for w in adams["w"]} and adams["g"]>=13
    if year==2025:
        for name in ("Ja'Marr Chase","Chase Brown"):
            p=get_player(players,name)
            assert {1,2,3,4}.issubset({w[0] for w in p["w"]}), name
        assert get_player(players,"Ja'Marr Chase")["p"]>280
        assert get_player(players,"Chase Brown")["p"]>250
        assert get_player(players,"Ashton Jeanty")["ryr"]==2025
        # Sleeper support: Seattle conceded 13 fantasy DST points allowed,
        # not Houston's full 19, due to a Houston defensive touchdown.
        sea=get_player(players,"SEA Defense")
        assert next(w for w in sea["w"] if w[0]==7)[16]==13
    print(f"PASS {year}: {len(players)} records, {d['throughWeek']} weeks, "+
          f"{len(rookies)} verified rookies",flush=True)


if __name__=="__main__":
    for season in ([int(x) for x in sys.argv[1:]] or YEARS):
        verify(season)
    manifest=json.loads((DATA/"seasons.json").read_text())
    assert manifest["years"]==YEARS, (manifest,YEARS)
    print("PASS research season index",YEARS,flush=True)
