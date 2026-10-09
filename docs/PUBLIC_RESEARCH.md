# Public research foundation

LeagueZone's beta research interface is served as **static public assets** at
\`/research\`. It is intentionally independent of account sessions, Sleeper
league pages, PostgreSQL, and the protected league APIs.

## Hard cost boundary

- Public views load only \`/research/data/<year>.json\` through the CDN.
- No user-facing request to public research is permitted to call Neon.
- No API proxy, dynamic Next.js page, or server-only code is imported by the
  public research bundle.
- All searching, scoring-format changes, sorting, and comparisons run locally
  in the browser.
- Existing league pages, DB migrations, and crawler gates remain unchanged.

## Dataset

Initial snapshot: 2026, through completed Week 4. Sourced from
NityaGehlot/nfl-data weekly public JSON. The source is a community-maintained
snapshot and is not an authoritative real-time score service. The generator
filters obvious team/opponent inconsistencies to reduce misattributed player
weeks. This does not resolve all possible upstream quality problems.

\`node scripts/refresh-public-research.mjs\` refreshes a seasonal JSON file.
There is a **manual** GitHub Actions workflow ("Refresh public research
snapshot") to publish future updates; it is intentionally not scheduled yet,
so we can establish actual build and traffic costs before adding recurring
deployments. A successful workflow commit will trigger the existing
production Git integration.

The initial release includes QB, RB, WR, TE, K. DEF/DST are not present
in this data source and must not be silently fabricated.

## Verification

1. All public research pages work with a missing or invalid DATABASE_URL.
2. A page visit only requests same-origin assets under /research/.
3. Public pages have no fetch calls to /api/, /l/, or /app.
4. The app works with JavaScript enabled and makes its data timestamp clear.
5. The existing league dashboards continue to work unchanged.

Important: This is an initial static research foundation, not an advanced
projection model, a live injury feed, or an exhaustive historical database.


## Historical snapshots (added October 9, 2026)

The public interface now serves **2023, 2024, 2025** full regular seasons and **2026** through Week 4. Each year lives in its own small static JSON file and is downloaded only when selected. All public player-history filters and comparisons are local to the visitor's browser.

Seasonal files are generated from public weekly JSON, validated for unique player/week tuples and consistent game counts. Incorrect retrospective team labels are screened using contemporaneous quarterback matchups. This filters some bad upstream records; it does not establish perfect correctness, and league-scoring/bonuses can differ from the source's PPR scoring convention. Confirm independent sample totals and note missing defense/DST before broadening coverage.

Public data refresh stays manual. The user should not enable scheduled refresh until transfer usage, build frequency, and source reliability are measured.
