# LeagueZone Public Research: nflverse static analytics

## Architecture
- Public research routes under /research use Vercel CDN static assets only.
- No public browsing request calls Neon, Sleeper, server APIs, or protected league data.
- Source: https://github.com/nflverse/nflverse-data (CC BY 4.0, subject to
  underlying source rights). Loader: nflreadpy via GitHub Actions.
- Historical player identity uses NFL GSIS IDs. Team defenses use DEF-{team}.
- We preserve all historical season files rather than overwrite or recompute
  league-managed fantasy data.

## Feature set
- Search; season totals and weekly leaderboards; position-appropriate statistics
  for QB, RB, WR, TE, K, DEF; PPR, half-PPR and standard reception adjustments.
- Verified rookie-only filtering uses nflverse's player metadata rookie_season,
  not draft_year or years of experience. Missing metadata stays unclassified,
  rather than making up a rookie designation.
- Player profiles include weekly fantasy-point charts, weekly game logs,
  season metrics, and career history across available seasons.
- Compare two player-seasons, including different seasons and the same player
  in two seasons. Cross-season data downloads only when requested.
- Responsive filters, mobile player result cards, scrollable position-specific
  game logs, accessible profile navigation.
- Filters (season, position, scoring, sort, week, minimum games, rookies,
  search) are kept in the list URL, so "Back to results" and browser history
  restore the previous view. Sortable column headers and a visible sort/scoring
  context line show how results are ranked.

## Metric definitions
All calculations live in public/research/metrics.js, a pure helper loaded by the
static page and unit tested directly. No new data files or requests are needed.
- Per game: season total / recorded games (`g`). Byes and missed games have no
  weekly row and are never counted as zero.
- FP/G, Tgt/G, Rec/G, Car/G, Rec yds/G, Pass yds/G, Touch/G (carries +
  receptions), plus kicker and DST per-game rates.
- Efficiency: YPC = rushing yards / carries; Y/Tgt = receiving yards / targets;
  Y/Rec = receiving yards / receptions; Catch % = receptions / targets;
  Yds/touch = (rushing + receiving yards) / touches. A zero denominator is shown
  as missing with a reason, never as 0.
- L3 / L5 avg: mean fantasy points over the last 3 or 5 recorded games in week
  order; missing until the player has that many games.
- Wk SD: population standard deviation of weekly fantasy points over recorded
  games (minimum 3). Volatility = SD / FP/G. Lower is steadier.
- High / Low: best and worst single recorded game (ties go to the earliest week).
- Recent usage: the last 3 recorded games versus all earlier recorded games in
  the same season (requires 5+ games).
- Every fantasy metric uses the selected reception adjustment (PPR 0, half 0.5,
  standard 1 per reception) applied to nflverse PPR points.
- Season mode and week mode are separate: season-only metrics (per-game, L3/L5,
  SD, High/Low) are not offered when a single week is selected.
- Applicability: passing metrics only for QB, receiving and touch metrics only
  for RB/WR/TE, rushing for QB/RB/WR/TE, kicking for K, defense for DST.
- Efficiency sorts list players below a qualifying volume (2 per completed
  week in season mode, 3 in a single week) after qualified players.
- Comparisons always show fantasy production, consistency and recent form;
  position metrics only appear for the same position or two skill positions,
  and only metrics that apply to both. In-progress seasons are labeled and
  compared on per-game and recent values.

## Season rollover
- scripts/build-nflverse-research.py uses the current NFL season by default
  (the previous calendar year during January–August) or accepts explicit
  --seasons. Existing history is not deleted.
- Every successful regeneration also writes public/research/data/seasons.json,
  listing all validated historical seasons, and only when the list changes.
- The UI reads this manifest instead of hard-coding year options. A newly
  validated and committed 2027 dataset appears as a 2027 option automatically.
- An unplayed or incomplete week is never published. Missing source data,
  metadata inconsistencies, duplicate weeks or implausible coverage abort
  publication before the snapshots are written.

## DST scoring verification
- Sleeper publishes a common 10/7/4/1/0/-1/-4 points-allowed scoring system,
  with +1 sack, +2 INT, +2 recovered fumble, +6 defensive or ST touchdown,
  +2 safety or blocked kick. Yahoo has a comparable default.
  https://sleeper.com/blog/how-fantasy-football-scoring-systems-work/
  https://help.yahoo.com/kb/fantasy-football/yahoo-league-sln6489.html
- Sleeper clarifies that defensive touchdowns by the opposing team are NOT
  charged against the fantasy defense for points-allowed; associated PATs
  still count:
  https://support.sleeper.com/en/articles/4126495-how-are-points-allowed-calculated
- We adjust game scoreboard points allowed by subtracting 6 for each opposing
  defensive touchdown from nflverse team weekly stats, while retaining PATs.
  2025 Week 7 Seattle/Houston is explicitly regression-tested: score 27–19,
  but Seattle's fantasy DST points allowed were 13 due to the Texans'
  defensive TD. This is an estimate, not provider-certified identical
  scoring for every special teams or uncommon play.
- Source records are verified against scheduled game IDs and opponent teams.
  There are no custom commissioner-scoring adjustments in the public UI.

## Updates, budgets and build control
- .github/workflows/refresh-public-research.yml runs Thursday at 12:00 UTC
  during NFL season months (September–January) for an already completed week
  after the midweek corrections. Additional manual workflow runs are optional.
- Only changed, validated static data files get committed, so identical source
  snapshots do not trigger a production deployment.
- A changed weekly snapshot committed to main WILL trigger one regular Vercel
  production build. This is a conscious trade-off to retain cheap static
  delivery; it is not zero build usage. Expected cadence is <= once weekly
  in-season if updates are available.
- Vercel preview deployments are disabled; GitHub Actions runs all QA for
  feature branches. No new Neon tables, cron jobs, or migrations.
- If future Vercel build counts become a constraint, move only the static
  research datasets and manifest to a CDN/R2 bucket, rather than moving
  research queries into the database.

## Tests
- scripts/validate-nflverse-research.py detects incomplete weeks, missing
  positions, malformed player game logs, rookie years, historical trade
  omissions, DST scoring errors, and a mismatched season manifest.
- tests/unit/public-research-static.test.ts checks season metadata, source
  isolation, static rewrites, and rookie classification availability.
- tests/e2e/public-research-history.spec.ts covers weekly leaderboards,
  position-specific columns, rookie filters, season comparisons, career
  profiles, mobile player cards and static data access without authorization.
- tests/unit/research-metrics.test.ts checks scoring adjustments, denominators,
  zero/missing values, recent averages across byes, consistency, extremes and
  recent-usage windows.
- tests/e2e/public-research-metrics.spec.ts and
  public-research-profiles.spec.ts cover new sorts, position-specific columns,
  week/season separation, scoring changes, missing-data labels, rookie filters,
  filter restoration, profile trends, K/DST profiles, in-progress seasons,
  cross-season and unrelated-position comparisons, and a 360px phone layout.

## Known limitations
- nflverse weekly player stats do not supply verified offensive snap counts in
  this feed (the `snap` field is null in every snapshot). The research UI does
  not show guessed snap shares.
- Routes, target share (team target totals are not in the snapshot), air yards,
  aDOT, expected fantasy points, red-zone usage and passing attempts or
  completions are not in the snapshots, so they are not shown.
- Default DST scoring does not exactly reproduce every fantasy provider's
  treatment of return touchdowns, blocked kicks, and other rare events.
- The publicly available 2023–2026 snapshots do not cover every prior NFL
  season, and current NFL injuries are not a live feed.
- Custom league scoring, proprietary fantasy projections, comprehensive
  snap/route charts, and verified historical playoff stats are not included.
