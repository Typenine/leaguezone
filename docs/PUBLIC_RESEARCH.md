# LeagueZone public NFL research: direct nflverse feed

## Architecture and cost boundary
- Public research at /research uses only season JSON files in public/research/data.
- No Neon query, Sleeper API call, authenticated endpoint, or Next.js server
  operation is made when visitors browse research.
- League management, historic drafts, trades, records, and administrative data
  are untouched by this importer.
- Source: https://github.com/nflverse/nflverse-data (CC BY 4.0;
  check upstream rights before paid redistribution).
- Python loader: nflreadpy. Data is downloaded and validated in GitHub Actions.
- Do not use the old NityaGehlot intermediary; it mislabeled historical game
  participation and teams, leading to missing player weeks and kickers.

## Publishing data
- 'python scripts/build-nflverse-research.py --seasons 2023 2024 2025 2026'
  builds separate compact season files.
- 'python scripts/validate-nflverse-research.py' verifies all four seasons,
  missing positions, duplicate weeks, score sums, and traded-player examples.
- GitHub Actions workflow 'Refresh public research snapshot' runs the above,
  typecheck, unit tests, and desktop/mobile Playwright checks on the migration
  branch. On default branch it runs at most once per week on Thursday at
  12:00 UTC, after NFL midweek stat corrections.
- The workflow commits static files only when actual data changed. A commit
  on main triggers the site's normal production build. No web traffic causes
  refresh jobs or database load.
- Fail closed: if source, matchup IDs, schedule coverage, kicker participation,
  or historical season completeness fails, published files are preserved.

## Statistics and known limitations
- Players: QB, RB, WR, TE season totals, weekly game logs, PPR, half-PPR and
  standard receiving adjustments; passing, rushing and receiving statistics.
- Kicking: built explicitly from made field goals by distance band
  (0–39 yards = 3, 40–49 = 4, 50+ = 5) and made PAT = 1.
- Team defense/st: derived from nflverse weekly team stats and NFL game
  scores, with the scoring formula spelled out in the code.
- Defensive fantasy point totals are a **default estimate**. Total-score
  points-allowed bands may differ from provider rules when opposing defensive
  or return touchdowns occur; blocks, safeties and turnovers can have
  provider-specific variations. They are not league-specific projections.
- Direct nflverse player statistics do not include verified offensive snaps;
  do not silently show zeros or sort by missing data.
- Custom scoring rules, verified rookie-class filters, and live injury feeds
  remain outside the initial public research scope.
- Source data may change after NFL stat corrections; dates on files indicate
  the last actual content revision, not the last time the updater ran.

## Important validation
- 2025 Bengals players must retain Weeks 1–4 after the Joe Flacco trade.
- 2024 Davante Adams must retain early Raiders games after joining the Jets.
- 2023–2025 kickers must appear for all weeks, not only a single stray week.
- Each season has 32 DST rows (one per NFL team), with bye-week checks.
- No source rows with team/opponent/game ID discrepancies are accepted.
- Player-season PPR totals equal the sum of included weekly PPR totals.
- Public research pages and tests must continue to work on mobile and without
  any database connection.

## Season rollover
The refresh code can generate new seasons without rewriting earlier snapshots.
The static season selector currently enumerates 2023–2026; add a new season
option and update its permitted years when the 2027 data is ready. Do not
overwrite earlier season files.
