# Phase 4B – Availability & Opportunity Center

Route: /availability. Links from /weekly, /my-research, player profiles, platform nav, and static research tabs.

## Data and legal boundaries
- Public injury-status metadata originates from the documented Sleeper NFL players API, which is free **for non-commercial uses** only. Before charging, selling derivative injury feeds, or redistributing data to partners, obtain the appropriate permissions. There is no complete licensed official NFL practice feed.
- Sleeper requests are placed behind Next.js unstable_cache with a **24-hour TTL**, and the public filtered response uses CDN caching. No Neon queries, R2 writes, new cron jobs or database migrations. Provider outages show an official NFL link rather than made-up statuses.
- Metadata has a **retrieval time**, not a field-specific source publication time. We do **not** claim official Wednesday/Thursday/Friday practice records or real-time inactives.
- Missing fields or disappearing entries do not mean a player is healthy. The page only lists players with actual injury/practice/roster restriction metadata.
- The actual authoritative NFL injury report remains a linked, external original source. The site does not scrape or republish NFL.com.

## Product
- Search and filter by team, position, practice or game designation; optionally show followed players matched to GSIS IDs or **exact, unique** team/name/position identities from LeagueZone research.
- Mobile-friendly player cards, provider attribution, publication-age warning, original official NFL link and optional research profile links.
- Teammates in same position show last three *recorded games* of fantasy production with explicit sample counts, not future projections or starting roles.
- User-authorized league roster comparison is **on demand** and uses the existing secured league-opportunities endpoint. For Sleeper rosters compare Sleeper player IDs; other providers require an exact catalog GSIS mapping; no public or cross-league roster leakage. Never present `Not rostered` as confirmed waiver eligibility.
- Observed field changes are kept in **local browser storage** for at most 14 days and 120 entries. History starts with the first baseline on that device. It is not historical NFL practice data.
- No new push alerts until reports have verifiable publication timestamps and a reliable source. Existing research pushes are unchanged.

## Refresh and resilience
The provider directory is a large resource. Retrieve no more than once per 24 hours using a shared cache; avoid querying per player. The returned dataset is reduced to status-bearing NFL players. If a source response is invalid or missing, return HTTP 503 with a clear official NFL link; do not overwrite the last validated research dataset. A user pressing Recheck source rechecks the cached version instead of defeating the provider rate policy.

## Verification
Focused unit tests cover normalization, unknown-status handling, practice terminology, conservative identity matching and local history. Browser tests cover status, source/official links, search/team filters, opportunity details, mobile overflow and invalid team requests. Also run TypeScript, lint and production build. Authenticated roster lookup needs manual test with a consenting league user; do not claim it was tested without a live session.
