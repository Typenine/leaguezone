# Yahoo Fantasy Provider

LeagueZone treats Yahoo as a provider integration, not as a second set of Yahoo-specific league pages.

## Architecture

- `provider_accounts` stores a user's provider authorization. OAuth tokens are encrypted before they are written to Postgres.
- `league_provider_seasons` maps each LeagueZone season to the provider and provider league identifier used for that season.
- `provider_league_snapshots` stores normalized provider payloads that can be consumed by LeagueZone without exposing OAuth tokens to the browser.
- Legacy `leagues.sleeper_league_id` and `leagues.sleeper_league_ids` remain in place for compatibility while existing Sleeper reads are migrated to provider-neutral services.

This model allows one LeagueZone league to eventually contain seasons from different providers without changing the league's identity or historical franchise records.

## Yahoo activation

Yahoo setup is intentionally gated. All of the following are required before the Yahoo option becomes usable:

- `YAHOO_FANTASY_ENABLED=true`
- `YAHOO_CLIENT_ID`
- `YAHOO_CLIENT_SECRET`
- `YAHOO_REDIRECT_URI`
- `PROVIDER_TOKEN_ENCRYPTION_KEY` with at least 32 characters

Production callback URL:

`https://leaguezonehq.vercel.app/api/providers/yahoo/callback`

Yahoo Fantasy API access requires a Yahoo developer application with Fantasy Sports access approved by Yahoo.

## OAuth flow

1. An authenticated LeagueZone commissioner starts Yahoo setup.
2. LeagueZone stores short-lived, HTTP-only OAuth state and setup-league cookies.
3. The user authorizes LeagueZone at Yahoo.
4. Yahoo redirects to the server callback.
5. LeagueZone validates CSRF state and setup-league ownership.
6. Access and refresh tokens are encrypted before storage.
7. League discovery and league import happen server-side with the user's Yahoo authorization.

LeagueZone never asks for or receives the user's Yahoo password.

## Rollout safety

Do not enable `YAHOO_FANTASY_ENABLED` in production until Yahoo-backed normalized data has been connected to the core league read surfaces and validated. The initial provider work establishes OAuth, storage, league discovery, team import, provider-season mappings, and the migration path without changing the existing Sleeper runtime behavior.
