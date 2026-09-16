# Yahoo Fantasy provider

LeagueZone's Yahoo Fantasy integration uses the existing provider-neutral model. Yahoo is not a separate application path and should not bypass the normalized LeagueZone data layer.

## Production activation

Keep `YAHOO_FANTASY_ENABLED=false` until all production configuration is present and a real Yahoo account has completed OAuth and league-import QA.

Required server-side environment variables:

- `YAHOO_FANTASY_ENABLED`
- `YAHOO_CLIENT_ID`
- `YAHOO_CLIENT_SECRET`
- `YAHOO_REDIRECT_URI`
- `PROVIDER_TOKEN_ENCRYPTION_KEY` with at least 32 characters

The canonical production callback is:

`https://leaguezonehq.com/api/providers/yahoo/callback`

The Yahoo Developer Network application and Vercel Production environment must use that same complete callback URI. Do not use the Vercel preview domain as the production callback.

The Yahoo application must have Fantasy Sports API access. Consumer credentials and provider tokens are server-only and must never be committed, logged, rendered to the browser, or placed in screenshots.

LeagueZone intentionally treats activation as four separate milestones:

1. Code/configuration readiness.
2. Successful real Yahoo OAuth in production.
3. Successful real Yahoo football league discovery and import.
4. Verified production behavior across provider-neutral league surfaces.

A successful build only proves milestone 1.

## OAuth behavior

- `/api/providers/yahoo/start` requires an authenticated LeagueZone user and an owned setup league.
- LeagueZone creates a short-lived HTTP-only OAuth state cookie and setup-league cookie.
- `/api/providers/yahoo/callback` validates the state and revalidates setup-league ownership before saving tokens.
- Access and refresh tokens are encrypted at rest with `PROVIDER_TOKEN_ENCRYPTION_KEY`.
- Access tokens are refreshed before expiration and newly rotated Yahoo refresh tokens replace the previous token.
- Reconnecting the same LeagueZone user updates that user's existing Yahoo provider account.
- `DELETE /api/providers/yahoo/status` removes only the authenticated user's stored Yahoo connection. Imported league seasons and snapshots are preserved. Yahoo authorization itself can still be revoked by the user from Yahoo account settings.

## Discovery and import safety

Yahoo league discovery comes from the connected Yahoo account. The setup route verifies that the selected league was actually returned for that account and that the authenticated Yahoo manager is the league commissioner.

Historical discovery follows Yahoo's explicit renew/renewed links. LeagueZone does not infer continuity merely from a similar league name.

Re-import rules:

- Re-importing the same Yahoo provider league for the same season may refresh its metadata and snapshots.
- A Yahoo import must not replace a Sleeper mapping or a different Yahoo league already mapped to the same LeagueZone season.
- If a linked historical Yahoo season collides with an existing provider season, LeagueZone leaves the existing history intact and reports that season as skipped.
- The selected current Yahoo season is rejected with HTTP 409 if it would overwrite an existing provider-season mapping.

## Provider limitations

LeagueZone does not fabricate provider data Yahoo does not expose. In particular, Yahoo-backed seasons must not invent:

- taxi squads,
- future traded-pick ownership when Yahoo does not expose it,
- historical playoff bracket detail that Yahoo does not expose.

Provider capability messaging should surface those limitations explicitly.

## Production QA checklist

After real Yahoo credentials are configured, verify in production:

- connect, consent redirect, callback, state rejection, token exchange, refresh, reconnect, local disconnect, and Yahoo-side revocation behavior;
- football league discovery without manually entering opaque Yahoo IDs;
- current-season import and linked historical-season discovery;
- safe re-import behavior and mixed Yahoo/Sleeper season continuity;
- homepage, standings, rosters, team pages, matchups, transactions, trades, player pages, history, records, rivalries/head-to-head, projections, lineup optimizer, Health Center, Playoff Lab, Trade Block, Trade Analyzer, draft/history, and commissioner settings;
- historical season switching, unavailable-provider-data messaging, desktop layout, and mobile layout;
- no Sleeper-only IDs, labels, fake taxi data, fake traded-pick ownership, or current-year assumptions leaking into Yahoo views.

Do not declare Yahoo production-ready until OAuth, a real league import, and production surface QA have actually succeeded.
