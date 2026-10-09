#!/usr/bin/env python3
"""Build LeagueZone's optional red-zone and goal-line snapshots from nflverse.

Writes public/research/data/redzone/{season}.json next to (never over) the base
and usage files. Source: nflverse play-by-play via nflreadpy, regular season,
weeks up to the base season's validated throughWeek. Offline only: no Neon,
credentials or visitor calls. Nothing is published unless it validates.

Counting rules (documented in docs/PUBLIC_RESEARCH.md):
  zone       yardline_100 at the snap (line of scrimmage before the play):
             red zone <= 20, inside 10 <= 10, inside 5 <= 5.
  carry      rush_attempt == 1 with a rusher (designed runs, QB scrambles,
             aborted snaps the NFL scores as runs). Kneel-downs are excluded.
  target     pass_attempt == 1, not a sack, with an intended receiver,
             complete or not. Spikes and throwaways have no receiver.
  attempt    QB pass attempt: pass_attempt == 1 and not a sack (spikes count,
             as in official passing attempts).
  excluded   two-point tries and plays erased by accepted penalties: their
             attempt flags are 0. A play nflverse labels no_play but still
             scores as an attempt (post-play penalty, play stands) counts.
  touchdown  rushing TD: rush_touchdown and td_player_id == rusher;
             receiving TD: pass_touchdown and td_player_id == receiver;
             passing TD: pass_touchdown, credited to the passer.
             A TD scored after a lateral is not a red-zone TD for anyone.
A full-field run of the same rules (with kneels as carries) must reproduce the
base season's carries, targets, receptions and TDs for every published
player-week, or the season is rejected.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "research" / "data"
_spec = importlib.util.spec_from_file_location("redzone_validator", ROOT / "scripts" / "validate-research-redzone.py")
validator = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(validator)
PLAYER_FIELDS, TEAM_FIELDS, SKILL, BASE = validator.PLAYER_FIELDS, validator.TEAM_FIELDS, validator.SKILL, validator.BASE
P = {f: i for i, f in enumerate(PLAYER_FIELDS)}
T = {f: i for i, f in enumerate(TEAM_FIELDS)}
RULES = ("Snap yardline_100 <= 20 / 10 / 5. Carries: rush attempts with a rusher, including scrambles; kneel-downs "
         "excluded. Targets: non-sack pass attempts with an intended receiver, caught or not. Two-point tries and plays "
         "erased by accepted penalties excluded. TDs count only on plays snapped in the zone; lateral TDs excluded.")


def flag(row: dict, key: str) -> bool:
    return bool(row.get(key)) and float(row[key]) == 1.0


def zones(yl) -> list[str]:
    return [z for z, limit in (("rz", 20), ("i10", 10), ("i5", 5)) if yl <= limit]


def build_redzone(season: int, plays: list[dict], base: dict, stamp: str) -> dict:
    through = int(base["throughWeek"])
    wanted = {(p["id"], w[0]): w for p in base["players"] if p["pos"] in SKILL for w in p["w"]}
    seen_plays = set()
    teams: dict[tuple[str, int], list[int]] = {}
    players: dict[tuple[str, int], list] = {}
    full: dict[tuple[str, int], dict] = defaultdict(lambda: defaultdict(int))
    for row in plays:
        if row.get("season_type") != "REG" or not row.get("week") or int(row["week"]) > through:
            continue
        week, team, kind = int(row["week"]), row.get("posteam"), row.get("play_type")
        key = (row.get("game_id"), row.get("play_id"))
        if key in seen_plays:
            raise ValueError(f"Duplicate play {key}")
        seen_plays.add(key)
        if not team:
            continue
        teams.setdefault((team, week), [week] + [0] * (len(TEAM_FIELDS) - 1))
        rush, passed = flag(row, "rush_attempt"), flag(row, "pass_attempt") and not flag(row, "sack")
        kneel = kind == "qb_kneel" or flag(row, "qb_kneel")
        if flag(row, "two_point_attempt") or not (rush or passed):
            continue
        yl = row.get("yardline_100")
        if yl is None or not 0 < float(yl) < 100:
            raise ValueError(f"Scrimmage play {key} has invalid yardline_100 {yl}")
        zs = zones(float(yl))
        events = []  # (player_id, field-suffix, is_team_denominator)
        rusher, receiver, passer = row.get("rusher_player_id"), row.get("receiver_player_id"), row.get("passer_player_id")
        if rush and kneel and rusher:
            full[(rusher, week)]["car"] += 1
        if rush and not kneel and rusher:
            full[(rusher, week)]["car"] += 1
            td = flag(row, "rush_touchdown") and row.get("td_player_id") == rusher
            full[(rusher, week)]["rut"] += td
            events += [(rusher, "Car", True)] + ([(rusher, "RuTd", False)] if td else [])
        if passed and receiver:
            rec = flag(row, "complete_pass")
            td = flag(row, "pass_touchdown") and row.get("td_player_id") == receiver
            f = full[(receiver, week)]
            f["tgt"] += 1; f["rec"] += rec; f["rt"] += td
            events += [(receiver, "Tgt", True)] + ([(receiver, "Rec", False)] if rec else []) + ([(receiver, "ReTd", False)] if td else [])
        if passed and passer:
            ptd = flag(row, "pass_touchdown")
            full[(passer, week)]["pptd"] += ptd
            events += [(passer, "Att", False)] + ([(passer, "PaTd", False)] if ptd else [])
        # Lateral TDs count toward the lateral player's full-game totals (as in
        # nflverse) but are not red-zone opportunities: he got no carry/target.
        for kind_flag, td_flag, lat_key, stat in (("lateral_rush", "rush_touchdown", "lateral_rusher_player_id", "rut"),
                                                  ("lateral_reception", "pass_touchdown", "lateral_receiver_player_id", "rt")):
            lat = row.get(lat_key)
            if lat and flag(row, kind_flag) and flag(row, td_flag) and row.get("td_player_id") == lat and (rush or passed):
                full[(lat, week)][stat] += 1
        for pid, suffix, denominator in events:
            for z in zs:
                field = z + suffix
                if denominator:
                    teams[(team, week)][T[field]] += 1
                b = wanted.get((pid, week))
                if b is None or field not in P:
                    continue
                if b[1] != team:
                    raise ValueError(f"{pid} week {week}: play team {team} != base team {b[1]}")
                r = players.setdefault((pid, week), [week, team] + [0] * (len(PLAYER_FIELDS) - 2))
                r[P[field]] += 1
    for (pid, week), b in wanted.items():
        f = full.get((pid, week), {})
        for k in ("car", "tgt", "rec", "rut", "rt", "pptd"):
            if f.get(k, 0) != b[BASE[k]]:
                raise ValueError(f"{pid} week {week}: play-by-play {k} {f.get(k, 0)} != base {b[BASE[k]]}; rules or source disagree")
    out_players: dict[str, list] = defaultdict(list)
    for (pid, week), r in sorted(players.items()):
        out_players[pid].append(r)
    out_teams: dict[str, list] = defaultdict(list)
    for (team, week), r in sorted(teams.items()):
        out_teams[team].append(r)
    return {
        "year": season, "schema": validator.REDZONE_SCHEMA, "throughWeek": through,
        "baseUpdated": base.get("updated"), "updated": stamp,
        "source": "nflverse/nflverse-data play-by-play (regular season)",
        "sourceUrl": "https://github.com/nflverse/nflverse-data/releases/tag/pbp",
        "license": "CC BY 4.0 (subject to underlying source rights)", "rules": RULES,
        "fields": {"player": PLAYER_FIELDS, "team": TEAM_FIELDS},
        "teams": dict(sorted(out_teams.items())), "players": dict(sorted(out_players.items())),
    }


def write(path: Path, text: str) -> None:
    if path.exists() and path.read_text() == text:
        return
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+", type=int, required=True)
    args = parser.parse_args()
    import nflreadpy as nfl
    stamp = datetime.now(timezone.utc).date().isoformat()
    out = DEST / "redzone"
    pending = []
    for season in args.seasons:
        base_path = DEST / f"{season}.json"
        if not base_path.exists():
            raise SystemExit(f"No base season file for {season}; build it first")
        base = json.loads(base_path.read_text())
        plays = nfl.load_pbp([season]).to_dicts()
        try:
            rz = build_redzone(season, plays, base, stamp)
        except ValueError as e:
            raise SystemExit(f"Red zone {season} rejected; nothing published: {e}")
        errors = validator.validate_redzone(rz, base)
        if errors:
            raise SystemExit(f"Red zone {season} failed validation; nothing published:\n  " + "\n  ".join(errors[:20]))
        path = out / f"{season}.json"
        old = json.loads(path.read_text()) if path.exists() else None
        if old and old.get("throughWeek", 0) > rz["throughWeek"]:
            raise SystemExit(f"Red zone {season} would regress from week {old['throughWeek']}; keeping previous file")
        if old and {k: v for k, v in old.items() if k != "updated"} == {k: v for k, v in rz.items() if k != "updated"}:
            rz["updated"] = old["updated"]
        pending.append((path, rz))
        print(f"Validated red zone {season}: {len(rz['players'])} players through week {rz['throughWeek']}", flush=True)
    # Publish only after every requested season passed; the manifest goes last.
    out.mkdir(parents=True, exist_ok=True)
    for path, rz in pending:
        write(path, json.dumps(rz, separators=(",", ":"), ensure_ascii=False) + "\n")
    years = sorted({int(p.stem) for p in out.glob("20[0-9][0-9].json")})
    write(out / "seasons.json", json.dumps({"schema": validator.REDZONE_SCHEMA, "years": years}, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
