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
2. In Cloudflare R2 > bucket > Settings > Custom Domains, attach and verify a
   production hostname owned by the LeagueZone domain. Do not use an r2.dev
   development address for real users. HTTPS must work.
3. Add a bucket CORS policy for GET/HEAD from both:
   https://www.leaguezonehq.com and https://leaguezonehq.com.
   Suggested allowed headers: Content-Type. Expose ETag and Content-Length.
   See https://developers.cloudflare.com/r2/buckets/cors/
4. In Cloudflare caching rules, cache all immutable /research/v1/objects/*.json
   for a long TTL, but make /research/v1/catalog.json short-lived (<=60 sec)
   or bypass cache. JSON is not cached by default without an appropriate
   Cloudflare Cache Rule. See https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
5. In GitHub repo Settings > Secrets and variables > Actions, define secrets:
   RESEARCH_R2_ACCOUNT_ID, RESEARCH_R2_ACCESS_KEY_ID,
   RESEARCH_R2_SECRET_ACCESS_KEY. Define public variables:
   RESEARCH_R2_BUCKET, RESEARCH_R2_PUBLIC_BASE (https://the-verified-host).
   Do NOT copy credentials into source files or workflows.
6. Run GitHub Actions > Refresh public research in R2 > Run workflow on main.
   Publishing verifies data against all research validators, checks R2 object
   sizes and public browser CORS, and updates the catalog only after uploads
   succeed. Inspect job logs to confirm success.
7. Verify remote /research/v1/catalog.json is reachable from both site origins
   and every advertised versioned season object returns valid JSON.
8. Only after successful publication and checks, set public/research/data-source.json
   publicBase to the verified R2 custom-domain HTTPS origin and merge once to
   main. This is the ONE required production deployment for the cutover.
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
