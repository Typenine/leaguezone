# Phase 4A — Weekly Football Center

Public URL: `/weekly` (linked from the homepage, Research navigation, signed-in dashboard and sitemap).

## What is implemented
- NFL regular-season game schedule, final scores, kickoff dates and stadium/roof designations from the maintained nflverse/nfldata schedule CSV.
- Defensive fantasy points allowed by position for QB/RB/WR/TE, built in the browser from the **existing validated LeagueZone R2 season snapshot**, using the schedule to identify real completed games. Three scoring formats, position filters, game count, last-three-game trends, ranks and league averages. No projections; no synthetic game results. Defense allowed denominators count *team games*, not player rows.
- Depth charts by team from the timestamped nflverse `depth_charts_{season}.csv` release. Fetch only after selecting a team; show source and observation timestamp; gracefully report unavailable feeds and schema changes. Listed rank is not snap share or an injury designation.
- National Weather Service hourly forecast at the listed stadium coordinates via a user-requested action. Stadium coordinates derive from greerreNFL/stadiums; the stadium must match and be inside the U.S. Weather is not shown as playing conditions for a venue listed as closed/dome. Forecasts beyond the NWS horizon or absent stadium metadata are unavailable, not fabricated.
- Optional ESPN NFL RSS original-title link list. ESPN terms require original titles/links unchanged and attribution. Source outages show a working external news link instead of fictitious articles.
- Watched players in this week's games via the existing saved-research client; mobile-responsive controls, no disabled placeholder buttons.

## Cost and publication
No migrations, new SQL queries, new GitHub crawlers, or R2 writes introduced. Four public Next.js APIs are cached:
- Schedule: 15 min + 1h stale window; source ~2MB all-season CSV parsed server-side and reduced to the requested season.
- Depth: 4h CDN / up to 24h stale; fetch on selection only. Source can be large; do not enable all-team automatic polling.
- NWS weather: 30m CDN; 24h cached point/geographic lookups and 30m grid forecasts. Fetch on explicit request only.
- News: 30m CDN on success, 5m on unavailable. No article copying.

Data is stored in provider-isolated UI-independent types (`src/lib/weekly-center.ts`). Errors never overwrite research snapshots or historical data. Existing R2 snapshots may lag the upcoming/current NFL week; the screen separately labels the stats week and schedule freshness.

## Verification
Unit tests: CSV multiline parsing, source validation, timestamped depth newest record, DST kickoff, defensive stats/denominators and scoring. E2E tests: schedule, forecast request, feed outage, narrow mobile, invalid inputs. Existing full CI test suite should run once before merge. Real-world ESPN/NWS/GitHub availability requires ongoing monitoring; automated browser tests mock HTTP sources.

## Limitations
- This is not a real-time play-by-play scoreboard. Scores change with the upstream schedule and cache.
- No licensed live injury/practice-report feed; no fabricated injury status.
- Depth chart 2025+ schema differs from older years; older historical depth files are not supported by the API adapter.
- Stadium names and roof classifications can change; overseas sites and any unmatched venue have no NWS forecast.
- Defense scoring uses player PPR values and receptions; no kicker/DEF matchup points-allowed rankings.
- Last 3 games describes historical opponent production only, not future points.
- No live user-access session or subscribed device integration validated via E2E.
- nflverse data attribution: CC BY 4.0 subject to underlying third-party data rights; review rights before any commercial redistribution.
- ESPN RSS can deny automated requests; only official feed response is displayed without altering headlines.

Sources:
- https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html
- https://github.com/nflverse/nfldata
- https://github.com/nflverse/nflverse-data/releases/tag/depth_charts
- https://www.weather.gov/documentation/services-web-api
- https://github.com/greerreNFL/stadiums
- https://www.espn.com/espn/news/story/_/id/3437834
