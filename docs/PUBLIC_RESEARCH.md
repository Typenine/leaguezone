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

## Known limitations
- nflverse weekly player stats do not supply verified offensive snap counts in
  this feed. The research UI does not show guessed snap shares.
- Default DST scoring does not exactly reproduce every fantasy provider's
  treatment of return touchdowns, blocked kicks, and other rare events.
- The publicly available 2023–2026 snapshots do not cover every prior NFL
  season, and current NFL injuries are not a live feed.
- Custom league scoring, proprietary fantasy projections, comprehensive
  snap/route charts, and verified historical playoff stats are not included.
