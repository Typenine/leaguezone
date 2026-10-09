#!/usr/bin/env python3
"""Build LeagueZone's DB-free research snapshots directly from nflverse.

Run on GitHub Actions, not inside the LeagueZone web application.
Requires nflreadpy and polars. No Sleeper, credentials or Neon connection.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

POSITIONS = {"QB", "RB", "WR", "TE", "K"}
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "research" / "data"


def number(row: dict, key: str) -> float:
    value = row.get(key)
    if value is None:
        return 0.0
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"Non-finite {key}: {row.get('player_id')}")
    return value


def integer(row: dict, key: str) -> int:
    return int(number(row, key))


def kicker_points(row: dict) -> float:
    """Explicit LeagueZone default: FG 0-39=3, 40-49=4, 50+=5, PAT=1.

    No negative points for missed kicks. Custom league scoring is NOT supported.
    """
    band_keys = ("fg_made_0_19", "fg_made_20_29", "fg_made_30_39",
                 "fg_made_40_49", "fg_made_50_59", "fg_made_60_")
    if not all(key in row for key in band_keys):
        raise ValueError("nflverse is missing field-goal distance buckets")
    if abs(sum(number(row, key) for key in band_keys) - number(row, "fg_made")) > 0.001:
        raise ValueError(f"FG bucket mismatch: {row.get('player_id')}, week {row.get('week')}")
    return round(3 * sum(number(row, k) for k in band_keys[:3])
                 + 4 * number(row, band_keys[3])
                 + 5 * sum(number(row, k) for k in band_keys[4:])
                 + number(row, "pat_made"), 2)


def has_activity(row: dict) -> bool:
    if row["position"] == "K":
        return any(number(row, k) > 0 for k in ("fg_att", "pat_att", "fg_made", "pat_made"))
    keys = ("attempts", "carries", "targets", "receptions", "passing_yards",
            "rushing_yards", "receiving_yards", "passing_tds", "rushing_tds",
            "receiving_tds", "special_teams_tds", "passing_interceptions")
    return any(number(row, key) != 0 for key in keys) or number(row, "fantasy_points_ppr") != 0


def completed_weeks(schedule_rows: list[dict], season: int) -> int:
    """Only publish fully completed regular-season weeks; not Thursday partials."""
    games: dict[int, list[dict]] = defaultdict(list)
    for row in schedule_rows:
        if int(row.get("season") or 0) != season:
            continue
        if row.get("game_type", row.get("season_type")) != "REG":
            continue
        week = int(row.get("week") or 0)
        if 1 <= week <= 18:
            games[week].append(row)
    last = 0
    for week in range(1, 19):
        listed = games.get(week, [])
        # Bye weeks can have fewer than 16 games. Fewer than 12 is suspicious.
        if len(listed) < 12 or any(
            row.get("home_score") is None or row.get("away_score") is None
            for row in listed
        ):
            break
        last = week
    if last == 0:
        raise ValueError(f"No completed regular-season week in schedule for {season}")
    return last


def dst_points(row: dict, allowed: int) -> float:
    """Default scoring: 1/sack, 2/takeaway, 6/TD, 2/safety or blocked kick,
    and a total-points-allowed bonus/penalty. Not universal league scoring."""
    pa_bonus = next((v for limit, v in [
        (0, 10), (6, 7), (13, 4), (20, 1), (27, 0), (34, -1)
    ] if allowed <= limit), -4)
    return round(number(row, "def_sacks") + 2 * number(row, "def_interceptions")
        + 2 * number(row, "fumble_recovery_opp")
        + 6 * (number(row, "def_tds") + number(row, "special_teams_tds"))
        + 2 * (number(row, "def_safeties") + number(row, "def_punt_blocks")
               + number(row, "def_fg_blocks"))
        + pa_bonus, 2)


def build_season(season: int, stats: list[dict], teams: list[dict], schedule: list[dict], stamp: str, player_meta: dict | None = None) -> dict:
    through = completed_weeks(schedule, season)
    by_id: dict[str, dict] = {}
    player_meta = player_meta or {}
    valid_games = {}
    for game in schedule:
        if int(game.get("season") or 0) != season or game.get("game_type") != "REG":
            continue
        week = int(game.get("week") or 0)
        if not 1 <= week <= through:
            continue
        for team, opponent in ((game.get("home_team"), game.get("away_team")),
                               (game.get("away_team"), game.get("home_team"))):
            if team and opponent:
                valid_games[(week, str(team))] = (str(opponent), str(game["game_id"]))
    weekly_seen: set[tuple[str, int]] = set()
    weekly_positions: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    mandatory = {"player_id", "player_display_name", "position", "team",
                 "season", "week", "season_type", "fantasy_points_ppr",
                 "receptions", "targets", "carries", "passing_yards",
                 "rushing_yards", "receiving_yards", "fg_made", "pat_made"}
    if not stats or not mandatory.issubset(stats[0]):
        raise ValueError(f"Unexpected nflverse player stats schema: {sorted(mandatory - set(stats[0] if stats else {}))}")
    for row in sorted(stats, key=lambda r: (int(r.get("week") or 0), str(r.get("player_id") or ""))):
        if int(row.get("season") or 0) != season or row.get("season_type") != "REG":
            continue
        week = int(row.get("week") or 0)
        if week < 1 or week > through or row.get("position") not in POSITIONS:
            continue
        if not row.get("player_id") or not row.get("team") or not has_activity(row):
            continue
        pid = str(row["player_id"])
        key = (pid, week)
        if key in weekly_seen:
            raise ValueError(f"Duplicate player/week: {season} {pid} week {week}")
        weekly_seen.add(key)
        pos = row["position"]
        name = str(row.get("player_display_name") or row.get("player_name") or "").strip()
        if not name:
            raise ValueError(f"Missing player name for {pid}")
        team = str(row["team"]).strip().upper()
        expected_game = valid_games.get((week, team))
        if not expected_game or expected_game != (str(row.get("opponent_team")), str(row.get("game_id"))):
            raise ValueError(f"nflverse player game/team mismatch: {season} {name} week {week} {team}")
        weekly_positions[week][pos] += 1
        points = kicker_points(row) if pos == "K" else round(number(row, "fantasy_points_ppr"), 2)
        if pid not in by_id:
            rookie_year = player_meta.get(pid)
            by_id[pid] = {
                "id": pid, "n": name, "pos": pos, "team": team, "g": 0,
                "p": 0.0, "rec": 0, "tgt": 0, "ry": 0, "rt": 0, "car": 0,
                "ruy": 0, "rut": 0, "snap": None, "ppyd": 0, "pptd": 0,
                "pint": 0, "fgm": 0, "xpm": 0, "ryr": rookie_year,
                "w": [],
            }
        item = by_id[pid]
        if item["pos"] != pos:
            raise ValueError(f"Conflicting position for {pid} in {season}")
        item["team"] = team  # The team in the *most recent actual game*.
        item["g"] += 1
        item["p"] += points
        for src, dest in (
            ("receptions", "rec"), ("targets", "tgt"), ("receiving_yards", "ry"),
            ("receiving_tds", "rt"), ("carries", "car"), ("rushing_yards", "ruy"),
            ("rushing_tds", "rut"), ("passing_yards", "ppyd"),
            ("passing_tds", "pptd"), ("passing_interceptions", "pint"),
            ("fg_made", "fgm"), ("pat_made", "xpm"),
        ):
            item[dest] += integer(row, src)
        # First eight entries preserve the deployed research UI's game-log contract.
        item["w"].append([
            week, team, points, integer(row, "receptions"), integer(row, "targets"),
            integer(row, "receiving_yards"), integer(row, "carries"),
            integer(row, "rushing_yards"), integer(row, "passing_yards"),
            integer(row, "passing_tds"), integer(row, "passing_interceptions"),
            integer(row, "fg_made"), integer(row, "pat_made"),
            integer(row, "rushing_tds"), integer(row, "receiving_tds"),
        ])
    matchups = {}
    for game in schedule:
        if int(game.get("season") or 0) != season or game.get("game_type") != "REG":
            continue
        week = int(game.get("week") or 0)
        if not 1 <= week <= through:
            continue
        for team, opponent, points_against in (
            (game.get("home_team"), game.get("away_team"), game.get("away_score")),
            (game.get("away_team"), game.get("home_team"), game.get("home_score")),
        ):
            if team and opponent and points_against is not None:
                matchups[(week, str(team))] = (str(opponent), int(points_against))
    # Exclude opponent defensive touchdowns from points allowed. Opponent PATs
    # still count. Sleeper documents this distinction explicitly.
    defense_tds_by_week = {
        (int(r["week"]), str(r["team"])): int(number(r, "def_tds"))
        for r in teams if int(r.get("season") or 0) == season
        and r.get("season_type") == "REG" and r.get("team")
    }
    seen_def = set()
    for row in teams:
        if int(row.get("season") or 0) != season or row.get("season_type") != "REG":
            continue
        week, team = int(row.get("week") or 0), str(row.get("team") or "")
        if not 1 <= week <= through or (week, team) not in matchups:
            continue
        opponent, final_score = matchups[(week, team)]
        opposing_def_tds = defense_tds_by_week.get((week, opponent))
        if opposing_def_tds is None:
            raise ValueError(f"Missing opposing defense for {season} week {week} {team}")
        allowed = final_score - 6 * opposing_def_tds
        if allowed < 0:
            raise ValueError(f"Impossible points allowed: {season} week {week} {team}")
        if row.get("opponent_team") != opponent or (week, team) in seen_def:
            raise ValueError(f"Invalid defense matchup: {season} week {week} {team}")
        seen_def.add((week, team))
        pid = "DEF-" + team
        if pid not in by_id:
            by_id[pid] = {
                "id": pid, "n": team + " Defense", "pos": "DEF", "team": team,
                "g": 0, "p": 0.0, "rec": 0, "tgt": 0, "ry": 0, "rt": 0, "ryr": None,
                "car": 0, "ruy": 0, "rut": 0, "snap": None,
                "ppyd": 0, "pptd": 0, "pint": 0, "fgm": 0, "xpm": 0,
                "sacks": 0.0, "ints": 0, "fr": 0, "pa": 0, "w": [],
            }
        item = by_id[pid]
        points = dst_points(row, allowed)
        item["g"] += 1
        item["p"] += points
        item["sacks"] += number(row, "def_sacks")
        item["ints"] += integer(row, "def_interceptions")
        item["fr"] += integer(row, "fumble_recovery_opp")
        item["pa"] += allowed
        item["w"].append([week, team, points, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                          round(number(row, "def_sacks"), 1),
                          integer(row, "def_interceptions"),
                          integer(row, "fumble_recovery_opp"), allowed])
        weekly_positions[week]["DEF"] += 1
    for week in range(1, through + 1):
        expected = sum(1 for game_week, _ in matchups if game_week == week)
        if expected < 24 or weekly_positions[week]["DEF"] != expected:
            raise ValueError(f"Incomplete defenses week {week}: expected {expected}")
    people = list(by_id.values())
    for item in people:
        item["p"] = round(item["p"], 2)
        if item["g"] != len(item["w"]):
            raise ValueError(f"Game count mismatch: {item['n']}")
    # Fail closed. Do not publish a partial history, especially missing kickers.
    if len(people) < 350 or any(
        weekly_positions[week]["QB"] < 20 or weekly_positions[week]["WR"] < 75
        or weekly_positions[week]["K"] < 20
        for week in range(1, through + 1)
    ):
        raise ValueError(f"Missing players/positions for {season}; refusing to overwrite snapshot")
    today = datetime.now(timezone.utc)
    is_previous_season_still_finishing = season == today.year - 1 and today.month <= 2
    if season < today.year and through < 18 and not is_previous_season_still_finishing:
        raise ValueError(f"Historical season {season} is not complete")
    people.sort(key=lambda p: (-p["p"], p["n"], p["id"]))
    return {
        "year": season, "throughWeek": through, "updated": stamp,
        "source": "nflverse/nflverse-data weekly player statistics (direct)",
        "sourceUrl": "https://github.com/nflverse/nflverse-data/releases",
        "license": "CC BY 4.0 (subject to underlying source rights)",
        "scoring": "NFL fantasy PPR; K: 3/4/5 by distance and PAT=1; DEF: default formula, total game points allowed",
        "schema": 3, "players": people,
    }


def guard_previous(old: dict | None, new: dict) -> None:
    if not old or old.get("year") != new["year"]:
        return
    if old.get("throughWeek", 0) > new["throughWeek"]:
        raise ValueError("New data covers fewer completed weeks; retaining previous snapshot")
    if old.get("schema") == new["schema"] and old.get("throughWeek") == new["throughWeek"]:
        if len(new["players"]) < int(len(old["players"]) * 0.95):
            raise ValueError("New source lost more than 5% of historical players")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+", type=int, default=None)
    args = parser.parse_args()
    # Bounded offline GitHub Actions processing; no Neon or visitor requests.
    if args.seasons is None:
        now = datetime.now(timezone.utc)
        args.seasons = [now.year if now.month >= 9 else now.year - 1]
    import nflreadpy as nfl
    metadata = nfl.load_players().select(["gsis_id", "rookie_season"]).to_dicts()
    player_meta = {}
    for entry in metadata:
        raw_year = entry.get("rookie_season")
        if not entry.get("gsis_id") or raw_year is None:
            continue
        rookie_year = int(raw_year)
        if 1920 <= rookie_year <= datetime.now(timezone.utc).year:
            player_meta[str(entry["gsis_id"])] = rookie_year

    stamp = datetime.now(timezone.utc).date().isoformat()
    pending: list[tuple[Path, dict]] = []
    for season in args.seasons:
        print(f"Retrieving official nflverse weekly rows and schedules: {season}", flush=True)
        stats = nfl.load_player_stats(season, summary_level="week").to_dicts()
        schedule = nfl.load_schedules(season).to_dicts()
        teams = nfl.load_team_stats(season, summary_level="week").to_dicts()
        snapshot = build_season(season, stats, teams, schedule, stamp, player_meta)
        path = DEST / f"{season}.json"
        old = json.loads(path.read_text()) if path.exists() else None
        guard_previous(old, snapshot)
        if old and {k:v for k,v in old.items() if k != "updated"} == {k:v for k,v in snapshot.items() if k != "updated"}:
            snapshot["updated"] = old["updated"]
        pending.append((path, snapshot))
        print(f"Validated {season}: {len(snapshot['players'])} players through week {snapshot['throughWeek']}; "
              f"kickers={sum(p['pos']=='K' for p in snapshot['players'])}, "
              f"defenses={sum(p['pos']=='DEF' for p in snapshot['players'])}", flush=True)
    # Only write after every requested season passed; manifest enables rollover.
    DEST.mkdir(parents=True, exist_ok=True)
    years = sorted({int(p.stem) for p in DEST.glob("20[0-9][0-9].json")} |
                   {int(p.stem) for p, _ in pending})
    manifest = {"years": years}
    manifest_path = DEST / "seasons.json"
    for path, data in pending:
        text = json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
        if path.exists() and path.read_text() == text:
            print(f"Unchanged: {path}", flush=True)
            continue
        temp = path.with_suffix(".tmp")
        temp.write_text(text)
        os.replace(temp, path)
    manifest_text = json.dumps(manifest, separators=(",", ":")) + "\n"
    if not manifest_path.exists() or manifest_path.read_text() != manifest_text:
        tmp = manifest_path.with_suffix(".tmp")
        tmp.write_text(manifest_text)
        os.replace(tmp, manifest_path)
        print(f"Published season manifest: {years}", flush=True)


if __name__ == "__main__":
    main()
