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

## New R2 delivery architecture (opt-in, with safe fallback)
- The site remains hosted on Vercel, including research HTML/JS/CSS. Only
  season JSON files and a catalog are independently published to R2.
- GitHub Actions generates and verifies stats, then uploads changed immutable
  objects at research/v1/objects/{year}-{sha256}.json to R2 using the S3 API.
- An atomic pointer research/v1/catalog.json advertises available seasons,
  object keys, update timestamps, and checksums. Publish pointer last.
- An authenticated R2 GET re-reads and checks SHA-256 of every advertised
  object before the catalog is changed. Some GitHub-runner public Worker GETs
  receive a Cloudflare HTTP 403 even though incognito browser access works.
  This specific edge denial can be explicitly allowed after private SHA-256
  verification and manual public-browser confirmation. Other HTTP errors,
  corrupt files, missing data, and CORS errors remain publication failures.
- SHA-256 is calculated from canonical data EXCLUDING the run-specific
  'updated' stamp. Unchanged source statistics trigger zero writes.
- The browser optionally fetches a public R2 catalog and stat files, then
  falls back to the already-deployed Vercel static files if unavailable. On
  fallback, the UI explicitly says "Last validated backup". The fallback
  only reflects the latest website deployment, not the newest R2 update.
- A new 2027 season becomes available through the R2 catalog without any
  Vercel build or Git commit; older archived snapshots remain accessible.
- No Neon dependency, app API proxy, or Vercel function per research request.
- The weekly GitHub Action runs at 12:00 UTC Thursday in Sep-Jan, loads the
  correct NFL season, validates snapshots, and uploads directly to R2.
  Unlike the previous implementation, it NEVER commits updated data on main.
- A website code change still requires a normal Vercel production deployment.
  R2 publication by itself does not.

### Production activation checklist (external Cloudflare setup required)
1. Create a DEDICATED public-data R2 bucket, separate from the existing private
   team/media bucket. Use a private scoped R2 API token for GitHub Actions with
   write/read permissions only to this research bucket.
2. Cloudflare DNS for leaguezonehq.com is managed elsewhere. Use a small
   public Cloudflare Worker at https://leaguezone-research-data.patrickmmcnulty62.workers.dev
   with an R2 binding called RESEARCH_BUCKET pointing to leaguezone-research.
   Do not change the main site's DNS or use the R2 development URL.
3. The Worker (not a public R2 bucket URL) serves only research/v1/catalog.json
   and immutable research/v1/objects/*.json. It must allow CORS GET/HEAD from
   https://www.leaguezonehq.com and https://leaguezonehq.com.
   The bucket remains private; read access comes through RESEARCH_BUCKET.
4. The Worker sends immutable cache headers for object keys and a 60-second
   header for the catalog. Worker subrequests still count toward Workers
   limits; optional cache optimization can be considered after launch.
5. In GitHub repo Settings > Secrets and variables > Actions, define secrets:
   RESEARCH_R2_ACCOUNT_ID, RESEARCH_R2_ACCESS_KEY_ID,
   RESEARCH_R2_SECRET_ACCESS_KEY. Define public variables:
   RESEARCH_R2_BUCKET=leaguezone-research, and RESEARCH_R2_PUBLIC_BASE=
   https://leaguezone-research-data.patrickmmcnulty62.workers.dev.
   Do NOT copy credentials into source files or workflows.
6. Run GitHub Actions > Refresh public research in R2 > Run workflow on
   feature/research-r2-uploads BEFORE the production merge.
   Publishing verifies data against all research validators, checks R2 object
   sizes and public browser CORS, and updates the catalog only after uploads
   succeed. Inspect job logs to confirm success.
7. Verify remote /research/v1/catalog.json is reachable from both site origins
   and every advertised versioned season object returns valid JSON.
8. The initial 2023–2026 upload and public catalog were confirmed on October 9,
   2026. public/research/data-source.json now points at the verified HTTPS
   Worker origin. Merge once to main for the ONE production cutover deployment.
   Prior to this step the existing static delivery stays fully operational.
9. Rotate any previously committed R2 keys. Old Git history may still contain
   hard-coded credentials even after removing them from main; revocation is
   essential and requires Cloudflare account access.

### Safety and rollback
- Missing R2 credentials/domain => publication fails before changing catalog.
- Missing or malformed remote catalog => browser uses local static backup.
- Missing remote season object => browser attempts the archived Vercel copy.
- Historical seasons never deleted; old versioned objects are not purged.
- Reverting data-source.json publicBase to "" makes the browser use its
  Vercel static files again at the next code deployment.
- No additional Neon load, no automated Vercel uploads for weekly refreshes.

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
- Historical R2 snapshots are only as current as the last successful uploader;
  2023–2026 are the current archived seasons, and injuries are not live.
- Custom league scoring, proprietary fantasy projections, comprehensive
  snap/route charts, and verified historical playoff stats are not included.

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

## Advanced usage (optional dataset)

Advanced usage statistics live in separate files, `/research/data/usage/{season}.json`, listed in `/research/data/usage/seasons.json` (`{"schema":1,"years":[...]}`). The browser fetches them only when the **Columns: Advanced usage** view, an advanced sort, a QB/RB/WR/TE profile or a comparison needs them, caches each season for the visit, and keeps every core statistic working if the file is missing, unlisted or fails to load (cells show "—" with the reason).

### Source and schema (usage schema 1)

Built by `scripts/build-research-usage.py` from nflverse weekly player stats (`load_player_stats(summary_level="week")`) and weekly team stats (`load_team_stats(summary_level="week")`), regular season only, through the base file's `throughWeek`.

- `players[gsis_id]`: weekly rows `[week, team, att, cmp, pyd, car, tgt, rec, ay, yac]`, one row per base player-week (same GSIS IDs, same weeks, same team as `/research/data/{season}.json`). No names or positions are repeated; they come from the base file.
- `teams[team]`: weekly denominators `[week, att, car, tgt, ay]` for each team-week played.
- Metadata: `year`, `schema`, `throughWeek`, `baseUpdated`, `updated`, `source`, `sourceUrl`, `license`, `fields`.
- A field that nflverse leaves null is published as `null` and shown as unavailable; it is never converted to 0.

| Field | nflverse column |
|---|---|
| att / cmp / pyd | `attempts`, `completions`, `passing_yards` |
| car / tgt / rec | `carries`, `targets`, `receptions` |
| ay / yac | `receiving_air_yards`, `receiving_yards_after_catch` |
| team att / car / tgt / ay | team `attempts`, `carries`, `targets`, `receiving_air_yards` |

### Statistics

| Statistic | Formula | Applies to | Unavailable when |
|---|---|---|---|
| Att, Cmp | source totals | QB | usage not loaded |
| Comp % | cmp ÷ att | QB | 0 attempts |
| Y/A | passing yards ÷ att (sacks are not attempts, sack yards excluded) | QB | 0 attempts |
| Att/G, Cmp/G | total ÷ games with stats | QB | — |
| Target share | Σ player targets ÷ Σ team targets in the same games | RB, WR, TE | team targets 0 |
| Air yards | Σ receiving air yards (caught and uncaught targets; can be negative) | RB, WR, TE | source null |
| Air-yards share | Σ player air yards ÷ Σ team air yards in the same games | RB, WR, TE | team air yards ≤ 0 |
| aDOT | air yards ÷ targets | RB, WR, TE | 0 targets |
| YAC, YAC/Rec | Σ yards after catch; YAC ÷ receptions | RB, WR, TE | 0 receptions |
| Carry share | Σ player carries ÷ Σ team carries in the same games | QB, RB, WR, TE | team carries 0 |

Rules:
- **Team changes:** every week uses the denominator of the team the player played for that week. Season shares are weighted (sum of numerators ÷ sum of denominators), never an average of weekly percentages and never based on the final team only.
- **Same games only:** season shares count team opportunities only in the player's games with stats. Games in which he played but recorded nothing have no nflverse row, so shares can run slightly high for low-usage players (same limitation as "Games with stats").
- **Carry denominator:** team `carries` from nflverse weekly team stats, which equals play-by-play rush attempts excluding two-point tries. It includes QB designed runs, scrambles recorded as rushes and kneel-downs (verified for 2025: team carries match play-by-play rush attempts including the 434 kneels; excluding kneels does not match). Kneels therefore lower every non-QB's carry share slightly, consistently across teams and seasons.
- **Air-yards denominator:** the nflverse team value, not a sum of player rows. They differ in some team-weeks (371 in 2025) because the team total includes targets not credited to a rostered receiver. Our shares equal nflverse's own `target_share` and `air_yards_share` columns for every published 2023 and 2025 row.
- **Rate qualifiers:** Comp % and Y/A rank players with ≥ 14 attempts per team week (season) or ≥ 10 (single week); aDOT and YAC/Rec use the existing targets/receptions qualifiers.
- **Trends:** "Last 3 / Last 5" use the last 3 or 5 games with stats (byes and missed games skipped, never zero). "Recent opportunity vs. earlier games" compares the last 3 games with all earlier games of the same season (needs 5+ games, no later data). Changes are absolute: percentage points for shares, raw differences for per-game values, never percent growth from a small base. Opportunity is shown separately from fantasy production.
- **Comparisons:** only rates and shares (Att/G, Cmp/G, Comp %, Y/A, target/air-yards/carry share, aDOT, YAC/Rec) are compared across seasons, so incomplete seasons are not compared on totals.

### Coverage

Published for every season listed in `usage/seasons.json` (currently 2023–2026; 2026 partial). nflverse weekly stats go back to 1999, but older seasons are not built yet; the UI reads availability from the manifest, not from hard-coded years.

### Generate and validate

```
python scripts/build-research-usage.py --seasons 2023 2024 2025 2026
python scripts/validate-research-usage.py
```

The builder requires the base season file, validates each season in memory against it (`validate_usage`), refuses to publish if any season fails or if `throughWeek` would go backwards, writes each file atomically (`.tmp` + rename), and writes the manifest last. The validator checks schema/metadata, unique ascending weeks, no week past `throughWeek`, every row matching a base player-week (ID, week, team), carries/targets/receptions/passing yards reconciling with the base row, completions ≤ attempts, finite numbers, a team denominator for every row, and player totals not exceeding team totals.

### Publication contract (for the R2/refresh owner)

Not wired into the scheduled refresh yet. To integrate: run the builder after the base snapshot, then the validator; upload `usage/{season}.json` files before `usage/seasons.json`; never upload if validation fails (previous files stay live); keep earlier seasons untouched; serve with the same cache headers as base season files (the manifest should be short-lived/revalidated). Breaking field changes must bump `schema`; the browser ignores files whose schema it does not understand and falls back to core stats.

### Not included

Snap counts, routes, targets per route, red-zone usage, EPA/CPOE, expected fantasy points and true games played need additional sources or licensing review and are not shown.

## Red-zone and goal-line usage (optional dataset)

A third, separate, lazily loaded dataset adds scoring-area opportunity for QB, RB, WR and TE. It never changes the base season files or the Phase 2 usage files, and the research site works without it.

### Source and play eligibility

Source: nflverse play-by-play (`nflreadpy.load_pbp`), regular season only (`season_type == "REG"`), weeks 1 through the base season file's `throughWeek` (the base boundary stays authoritative; later source weeks are ignored). Each `(game_id, play_id)` is processed once; a duplicate rejects the season.

| Rule | nflverse fields | Treatment |
| --- | --- | --- |
| Zone | `yardline_100` | Yards from the opponent end zone **at the snap** (line of scrimmage before the play). Red zone `<= 20`, inside the 10 `<= 10`, inside the 5 (goal line) `<= 5`. Where the ball was caught or the play ended is not used. A scrimmage play with a missing or invalid value rejects the season. |
| Carry | `rush_attempt`, `rusher_player_id` | `rush_attempt == 1` with a rusher. Includes designed runs, **QB scrambles** (`qb_scramble`, scored as runs) and aborted snaps the NFL scores as runs. |
| Kneel-down | `play_type == "qb_kneel"` / `qb_kneel` | **Excluded** from red-zone carries and team denominators (not a scoring attempt). Kneels still count as carries in the full-game cross-check, as they do in official stats. |
| Target | `pass_attempt`, `sack`, `receiver_player_id`, `complete_pass` | Non-sack pass attempt with an intended receiver, **complete or incomplete**. Sacks, spikes and throwaways (no intended receiver) are not targets. Reception = `complete_pass == 1`. |
| QB pass attempt | `pass_attempt`, `sack`, `passer_player_id` | Non-sack pass attempt, including spikes (as in official attempts). Shown only as the QB passing role; a passing TD is never a QB carry, target or red-zone opportunity. |
| Two-point try | `two_point_attempt` | **Excluded** everywhere. |
| Penalties / no-plays | `play_type == "no_play"`, `rush_attempt`, `pass_attempt` | A play erased by an accepted penalty has both attempt flags 0 and is excluded. A small number of rows are labelled `no_play` while still scoring the attempt (a post-play penalty where the run or pass stands); these count, matching official carries and targets. Penalty yards never create an opportunity. |
| Aborted plays | `aborted_play` | Counted only when the NFL scores them as a rush or pass attempt (the flags above). |
| Rushing TD | `rush_touchdown`, `td_player_id` | Rusher scored on a carry snapped in the zone. |
| Receiving TD | `pass_touchdown`, `td_player_id` | Targeted receiver scored on a target snapped in the zone. |
| Passing TD | `pass_touchdown` | Credited to the passer on a red-zone attempt (QB passing role only). |
| Outside TDs | | A TD on a play snapped outside a zone is not a TD for that zone (a 30-yard TD is not a red-zone TD). TDs scored by a lateral recipient are not red-zone TDs for anyone (he had no carry or target). |

**Safety check:** the builder applies the same rules over the whole field and requires them to reproduce the base season's carries, targets, receptions, rushing, receiving and passing TDs for every published player-week. Any disagreement rejects the season and nothing is written. Every published 2023–2026 player-week passes.

### Schema (`/research/data/redzone/{season}.json`, schema 1)

`{year, schema, throughWeek, baseUpdated, updated, source, sourceUrl, license, rules, fields, teams, players}`

- `fields.player`: `week, team, rzCar, i10Car, i5Car, rzRuTd, i10RuTd, i5RuTd, rzTgt, i10Tgt, i5Tgt, rzRec, rzReTd, i10ReTd, i5ReTd, rzAtt, i5Att, rzPaTd`.
- `fields.team`: `week, rzCar, i10Car, i5Car, rzTgt, i10Tgt, i5Tgt` (team denominators for every team-week with a play).
- `players[gsis_id]` holds only weeks with at least one red-zone event, with the team he played for that week. No names or other metadata are repeated (they come from the base file).
- **Missing-data rule:** a base player-week with no red-zone row is a real zero *if* its team-week row exists. If the team-week row is missing, the week's values are unavailable (shown as "—"), never zero.
- Manifest: `/research/data/redzone/seasons.json` = `{"schema":1,"years":[...]}`.

### Statistics

Season values sum numerators over his recorded weeks and divide by the sum of **the team he played for in each of those weeks** (byes and weeks he has no stats are skipped; weekly percentages are never averaged; final team is never used for the season).

| Statistic | Formula | Applies to |
| --- | --- | --- |
| Red-zone / inside-10 / goal-line carries | count of carries snapped `<= 20 / 10 / 5` | QB, RB, WR, TE |
| Red-zone rushing TDs | rushing TDs on red-zone carries | QB, RB, WR, TE |
| Red-zone carry share | rzCar ÷ team rzCar | QB, RB, WR, TE |
| Goal-line carry share | i5Car ÷ team i5Car | QB, RB, WR, TE |
| Red-zone rushing TD rate | rzRuTd ÷ rzCar | QB, RB, WR, TE |
| Red-zone / inside-10 / goal-line targets, red-zone receptions, receiving TDs | counts as above | RB, WR, TE |
| Red-zone target share | rzTgt ÷ team rzTgt | RB, WR, TE |
| Red-zone target TD rate | rzReTd ÷ rzTgt | RB, WR, TE |
| Red-zone / inside-10 / goal-line opportunities | carries + targets | QB, RB, WR, TE |
| Red-zone opportunities per game | rzOpp ÷ games with stats | QB, RB, WR, TE |
| Red-zone opportunity share | (rzCar + rzTgt) ÷ (team rzCar + team rzTgt) | QB, RB, WR, TE |
| Goal-line opportunity share | (i5Car + i5Tgt) ÷ (team i5Car + team i5Tgt) | QB, RB, WR, TE |
| Red-zone TDs / TD per opportunity | (rzRuTd + rzReTd); ÷ rzOpp | QB, RB, WR, TE |
| Goal-line TDs / conversion | (i5RuTd + i5ReTd); ÷ i5Opp | QB, RB, WR, TE |
| Red-zone pass attempts, attempts inside 5, passing TDs, passing TD rate | rzPaTd ÷ rzAtt | QB |

A zero denominator (for example, a team with no goal-line carries) gives "—" with a reason, not 0%. Conversion rates are labelled **small sample** below 10 carries / targets / opportunities, 5 goal-line opportunities or 20 pass attempts; in rankings those players are listed after qualified players (weekly threshold 2). Small-sample rates are descriptive, not predictive.

### Interface

- **Columns: Red zone** and **Columns: Goal line (inside 5)** join Core stats and Advanced usage. Columns are position-specific; every column sorts. Choosing a red-zone sort switches to the Red zone view. The view is kept in the URL (`view=redzone|goalline`).
- **Profiles (QB/RB/WR/TE):** "Red-Zone and Goal-Line Usage" with an inside-20/10/5 table (rushing and receiving separate, plus team share), position groups (QB passing vs rushing; RB goal line, rushing, receiving; WR/TE receiving and goal line), last-3/last-5 opportunity per game and share, a last-3 vs earlier table (percentage-point changes), a weekly stacked carries/targets chart (non-QB) and a weekly table.
- **Comparisons:** per-game opportunity, shares and conversion with differences, plus season totals labelled "context only" with each side's recorded games. Unrelated position groups show none.
- **Loading:** the red-zone file is fetched only for the Red zone / Goal line views, a red-zone sort, a QB/RB/WR/TE profile or a comparison that needs it; cached per season. Kicker and defense profiles and ordinary visits never request it. If it fails or the season is not in the manifest, the view explains it, values show "—", and core statistics and advanced usage keep working.

### Generate, validate and test

```bash
python scripts/build-research-redzone.py --seasons 2023 2024 2025 2026
python scripts/validate-research-redzone.py
python scripts/test-research-redzone.py   # hand-built play fixtures (also run by npm run test)
```

The builder validates every requested season before writing any file, writes each file atomically (temp file + rename), refuses to replace a file with a lower `throughWeek`, keeps the previous `updated` stamp when content is unchanged, and writes the manifest last. Requires `nflreadpy` and Polars. Rebuild a season's red-zone file whenever its base file changes.

### Publication contract (for the R2/refresh owner)

Same contract as advanced usage: publish `/research/data/redzone/{season}.json` before `seasons.json`; short/revalidated cache for the manifest, normal cache for season files; never publish a file that failed `validate-research-redzone.py`; keep prior seasons; rollback = restore the previous season files and manifest; a breaking field change bumps `schema` (the site then treats the dataset as unavailable). The existing refresh workflow is unchanged; it will later need a step running the builder and validator after the base build.

### Limitations

- Coverage is the base seasons, 2023–2026. nflverse play-by-play goes back to 1999; older seasons need validation before publishing.
- Opportunities are carries and targets only: no snaps, routes or red-zone snap share (no licensed source), and per-game values divide by games with stats.
- Penalties that move the ball into the red zone create no opportunity until the next snap; penalty-only plays are not counted.
- nflverse's CC BY 4.0 licence does not by itself settle the NFL's rights in play-by-play data.
- No expected-touchdown or expected-fantasy-point models are included.

## Initial R2 + analytics integration (2026-10-09)
- The core season dataset is loaded from the versioned R2 catalog, with Vercel static fallback on errors.
- The advanced usage and red-zone datasets currently ship as Vercel static files at `/research/data/usage/` and `/research/data/redzone/`. They are not yet included in the base R2 catalog or automated uploader.
- Do not claim usage/red-zone advanced statistics remain current after the R2 base dataset moves beyond the matching advanced snapshot. The UI fails closed to core stats if snapshot weeks or base version disagree.
- Follow-up integration must extend the validated refresh/publishing workflow for both advanced datasets, upload immutable objects before their manifests, and preserve both history and fallback behavior. This must be tested before a full season of operation.

## Unified weekly research publication

The scheduled GitHub Action rebuilds the current NFL season's three datasets
(core, advanced usage and red zone) from nflverse, validates each against the
same base season and publishes one atomic R2 catalog. It does not update Neon
or commit weekly files to GitHub, so routine weekly publication creates no
Vercel build.

The catalog retains its existing "files" dictionary for base season files and
adds "datasets" for the two advanced datasets. Each group has a schema, years
and files indexed by year. Advanced object metadata includes baseUpdated to
confirm exact week/version alignment.

All three kinds use the existing Worker path:
research/v1/objects/{year}-{sha256}.json. No new Worker routing is required.
The publish job uploads all changed immutable objects, verifies their bytes
by authenticated R2 GET and only then moves research/v1/catalog.json.
Failure preserves the prior valid catalog; historical archives are retained.

Client downloads are lazy. The browser matches throughWeek and baseUpdated
against its selected core snapshot. Archived local files are used as fallback
only when both match. Otherwise, advanced values are unavailable with a
visible explanation rather than silently mixing older usage with newer points.

### Research entry points

LeagueZone's homepage links directly to public research. The research
overview provides working one-click starts for target share, goal-line
opportunities, quarterback passing volume and rookie production. Mobile
result cards now display position-specific selected Columns metrics.
The public sitemap includes the three main research URLs and core public
landing pages, while robots.txt continues excluding private league URLs.

## Opportunity tools beta release
- Opportunity Radar is calculated in the browser from the same season rows as
  player profiles. It compares the last two recorded games with the previous
  two. RB: carries + targets. WR/TE: targets. QB: pass attempts from the
  weekly core game log, with older snapshots using the optional usage file.
  A volume signal requires both a 1.5
  opportunity-per-game and 15% difference, plus a game in the last two weeks.
  QB volume must reach 15 attempts/game in either window, RB volume 5,
  and WR/TE targets 3. These eligibility cutoffs keep tiny roles out.
  Fantasy scoring is displayed separately; scoring never decides a volume signal.
  Volume can change because team plays change even if player share is flat.
- Prediction Receipts has two distinct cohorts. Historical replay uses each
  week's available games and evaluates two later games within three weeks.
  Signals for the same player are spaced three weeks apart. Confirmation means
  the future opportunity average remains above/below the pre-signal baseline
  by the same thresholds. The replay is descriptive, reconstructed after the
  fact, and must not be called forward predictive accuracy.
- A separate device-local forward ledger locks current-season Radar signals,
  their observation date, format and baseline, then scores them after two
  eligible games arrive. It is idempotent and survives refreshes in that
  browser. Clearing browser storage deletes it. It is not a durable,
  system-wide ledger; do not advertise a global accuracy rate until an
  append-only shared publication path has been designed and validated.
- Development Lab loads available season snapshots lazily, shows per-game
  trajectories and verified career year, and finds same-position completed
  historical seasons at the same career year by proximity of FP/game. With
  only 2023 onward in the archive, these are illustrative comparisons, not
  projections or a full career comp model. Missing rookie metadata is shown
  as unverified. Gaps and partial years are visible.
- Roster Opportunity Finder lives under each league's League navigation.
  A slug-scoped, rate-limited read endpoint reuses the league's normalized
  provider roster cache. It sends a slim Sleeper identity catalog when
  available. GSIS ID or unique name + position + NFL team matches are required
  before reporting an owner or an unrostered player. Yahoo can establish
  rostered players but not free agency with the current provider roster feed.
  Ambiguous matches are excluded. The finder links rostered Sleeper players
  to the trade analyzer and the existing prospect board for draft work; it
  does not invent prices, waiver eligibility, or rookie-draft recommendations.
- Public research pages still make no league API, Neon or Sleeper requests.
  Only the user-opened league finder loads provider roster data. No new tables
  or migrations are needed. The core snapshot builder includes QB attempts on
  each weekly refresh; the separate advanced usage file remains a historical
  fallback and is not refreshed by the current R2 workflow.


## Analytics tools stabilization and beta limitations

- The opportunity foundation branch is based on the latest production R2 loader,
  mobile Columns view, public home research navigation and weekly publication.
- Radar scores short-term role change independently of fantasy points, and
  supplements the original volume signal with weighted in-game team shares,
  air yards and red-zone usage only when matching validated data is loaded.
  Two-game windows remain exploratory, not forecasting or causal proof.
- The forward-receipt publication path records the ongoing current NFL season
  after a successful validated refresh. It captures the publisher's UTC
  timestamp, model version, observation week, data version and eligible signals
  in content-addressed R2 objects. The atomic catalog index is append-only by
  (season,week); a re-run never rewrites the week's original signal snapshot.
  No historical backfill is labeled a forward record.
- Forward scoring uses a fixed half-PPR context. Later outcomes are computed
  from post-observation game logs, while historical replay is separate and
  not evidence of forward predictive accuracy. Incomplete follow-up stays
  unresolved. Browser storage is not authoritative.
- Development Lab adds verifiable opportunities/game, same-game target shares
  when available, and position-specific production efficiency. Career-stage
  peer comparisons remain descriptive, limited to 2023 onward.
- Roster Finder is member-gated at the server, even for slugs that otherwise
  have public league pages. Provider rosters and player identities must not
  be cache-shared publicly. Scoring defaults use league settings when standard,
  half-PPR or full-PPR; otherwise users can choose a supported view. Yahoo
  unrostered status is not asserted, and Sleeper unrostered players are not
  assumed waiver-eligible. Opposing roster membership is not trade availability.
- The finder does not yet calculate trade feasibility, complete waiver rule
  eligibility, or draft-pick values. Those remain out of scope until underlying
  league provider data and authenticated end-to-end tests support them.
- No new public Neon reads, schema migrations, or runtime provider integrations
  were added to the public research pages. The authenticated Finder alone
  requests the league's existing normalized provider roster cache.
