#!/usr/bin/env python3
"""Hand-built play-by-play fixtures for build-research-redzone.py eligibility rules.

Stdlib only (no nflreadpy). Expected counts are worked out by hand in comments.
Run: python scripts/test-research-redzone.py
"""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("rz_builder", ROOT / "scripts" / "build-research-redzone.py")
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)
F = B.PLAYER_FIELDS
TF = B.TEAM_FIELDS
N = [0]


def play(**kw):
    N[0] += 1
    row = {"season_type": "REG", "week": 1, "game_id": "g1", "play_id": float(N[0]), "posteam": "AAA",
           "play_type": "run", "yardline_100": 50.0, "rush_attempt": 0.0, "pass_attempt": 0.0, "sack": 0.0,
           "qb_kneel": 0.0, "qb_scramble": 0.0, "two_point_attempt": 0.0, "complete_pass": 0.0,
           "rush_touchdown": 0.0, "pass_touchdown": 0.0, "td_player_id": None, "rusher_player_id": None,
           "receiver_player_id": None, "passer_player_id": None}
    row.update(kw)
    return row


def run(pid, yl, **kw):
    return play(play_type="run", rush_attempt=1.0, rusher_player_id=pid, yardline_100=float(yl), **kw)


def pas(rec, yl, **kw):
    return play(play_type="pass", pass_attempt=1.0, passer_player_id="QB1", receiver_player_id=rec, yardline_100=float(yl), **kw)


PLAYS = [
    run("RB1", 15),                                                    # RZ carry
    run("RB1", 4, rush_touchdown=1.0, td_player_id="RB1"),             # RZ/10/5 carry + TD
    run("RB1", 30, rush_touchdown=1.0, td_player_id="RB1"),            # TD snapped outside the RZ: not RZ
    play(play_type="no_play", rusher_player_id="RB1", yardline_100=3.0),  # erased by accepted penalty
    run("RB1", 2, two_point_attempt=1.0, rush_touchdown=1.0, td_player_id="RB1"),  # two-point try
    play(play_type="no_play", rush_attempt=1.0, rusher_player_id="RB1", yardline_100=6.0),  # post-play penalty, run stands
    run("QB1", 8, qb_scramble=1.0),                                    # scramble: RZ/10 carry for the QB
    play(play_type="qb_kneel", rush_attempt=1.0, qb_kneel=1.0, rusher_player_id="QB1", yardline_100=18.0),  # kneel
    play(play_type="pass", pass_attempt=1.0, sack=1.0, passer_player_id="QB1", yardline_100=12.0),  # sack
    pas("WR1", 9),                                                     # incomplete RZ/10 target
    pas("WR1", 3, complete_pass=1.0, pass_touchdown=1.0, td_player_id="WR1"),   # RZ/10/5 target, rec, TD
    pas("WR1", 25, complete_pass=1.0, pass_touchdown=1.0, td_player_id="WR1"),  # TD from outside the RZ
    play(play_type="qb_spike", pass_attempt=1.0, passer_player_id="QB1", yardline_100=11.0),  # spike: attempt, no target
    run("RB1", 1, season_type="POST", week=19, rush_touchdown=1.0, td_player_id="RB1"),       # postseason
    run("RB1", 1, week=2),                                             # beyond throughWeek
    play(play_type="punt", posteam="BBB", yardline_100=40.0),          # opponent team-week, no scrimmage play
]
# Full-game base rows must agree with the same rules (kneels count as carries):
# RB1 carries 15,4,30,6 = 4, rush TDs 2; QB1 carries scramble + kneel = 2, pass TDs 2;
# WR1 targets 3, receptions 2, receiving TDs 2.
W = lambda team, rec=0, tgt=0, car=0, pptd=0, rut=0, rt=0: [1, team, 0, rec, tgt, 0, car, 0, 0, pptd, 0, 0, 0, rut, rt]
BASE = {"year": 2099, "throughWeek": 1, "updated": "x", "players": [
    {"id": "RB1", "pos": "RB", "w": [W("AAA", car=4, rut=2)]},
    {"id": "QB1", "pos": "QB", "w": [W("AAA", car=2, pptd=2)]},
    {"id": "WR1", "pos": "WR", "w": [W("AAA", rec=2, tgt=3, rt=2)]},
    {"id": "K1", "pos": "K", "w": [[1, "AAA", 5] + [0] * 12]}]}


def build(plays=PLAYS, base=BASE):
    return B.build_redzone(2099, [dict(p) for p in plays], base, "2099-01-01")


def row(out, pid):
    return dict(zip(F, out["players"][pid][0]))


class EligibilityRules(unittest.TestCase):
    def test_rb_carries_exclude_two_point_no_play_and_outside_tds(self):
        r = row(build(), "RB1")
        # 15, 4 and the post-play-penalty 6 yard run; 30-yard TD, erased run and 2pt excluded.
        self.assertEqual((r["rzCar"], r["i10Car"], r["i5Car"]), (3, 2, 1))
        self.assertEqual((r["rzRuTd"], r["i10RuTd"], r["i5RuTd"]), (1, 1, 1))

    def test_qb_scramble_counts_kneel_and_sack_do_not(self):
        r = row(build(), "QB1")
        self.assertEqual((r["rzCar"], r["i10Car"], r["i5Car"]), (1, 1, 0))
        # Attempts: 9, 3 and the spike at 11; the sack is not an attempt.
        self.assertEqual((r["rzAtt"], r["i5Att"], r["rzPaTd"]), (3, 1, 1))
        self.assertEqual(r["rzTgt"], 0)

    def test_targets_count_incompletions_and_only_zone_tds(self):
        r = row(build(), "WR1")
        self.assertEqual((r["rzTgt"], r["i10Tgt"], r["i5Tgt"], r["rzRec"]), (2, 2, 1, 1))
        self.assertEqual((r["rzReTd"], r["i10ReTd"], r["i5ReTd"]), (1, 1, 1))

    def test_team_denominators_and_empty_team_weeks(self):
        out = build()
        self.assertEqual(dict(zip(TF, out["teams"]["AAA"][0])), {"week": 1, "rzCar": 4, "i10Car": 3, "i5Car": 1, "rzTgt": 2, "i10Tgt": 2, "i5Tgt": 1})
        self.assertEqual(out["teams"]["BBB"], [[1, 0, 0, 0, 0, 0, 0]])
        self.assertNotIn("K1", out["players"])
        self.assertEqual(B.validator.validate_redzone(out, BASE), [])

    def test_duplicate_play_rejected(self):
        with self.assertRaises(ValueError):
            build(PLAYS + [dict(PLAYS[0])])

    def test_base_disagreement_rejected(self):
        base = {**BASE, "players": [{**BASE["players"][0], "w": [W("AAA", car=5, rut=2)]}] + BASE["players"][1:]}
        with self.assertRaisesRegex(ValueError, "car 4 != base 5"):
            build(base=base)

    def test_team_attribution_mismatch_rejected(self):
        base = {**BASE, "players": [{**BASE["players"][0], "w": [W("CCC", car=4, rut=2)]}] + BASE["players"][1:]}
        with self.assertRaisesRegex(ValueError, "base team CCC"):
            build(base=base)

    def test_missing_yardline_rejected(self):
        with self.assertRaisesRegex(ValueError, "yardline_100"):
            build(PLAYS + [play(play_type="run", rush_attempt=1.0, rusher_player_id="RB1", yardline_100=None)])

    def test_validator_rejects_fabricated_and_unplayed_rows(self):
        out = build()
        out["players"]["RB1"].append([2, "AAA"] + [1] * (len(F) - 2))
        out["players"]["WR1"][0][F.index("rzRec")] = 5
        errors = B.validator.validate_redzone(out, BASE)
        self.assertTrue(any("no matching base skill row" in e for e in errors))
        self.assertTrue(any("rzRec 5 > rzTgt" in e for e in errors))


if __name__ == "__main__":
    unittest.main(verbosity=1)
