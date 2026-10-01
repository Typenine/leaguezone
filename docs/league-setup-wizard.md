# League Setup Wizard

## Purpose

LeagueZone setup creates a league site for an already authenticated LeagueZone account. The account that creates the league becomes that league's commissioner through `leagues.commissioner_user_id`.

League setup must never create or grant a platform-admin account.

## Current setup flow

1. **League Identity**
   - League name
   - URL slug
   - Optional short name
   - Optional founded year
2. **Fantasy Provider**
   - Sleeper: enter/import the league and linked historical seasons
   - Yahoo Fantasy: authorize Yahoo, choose a league returned by the connected account, and import linked history where Yahoo exposes it
3. **Branding**
   - Primary/secondary colors
   - Optional league logo
4. **Team Colors**
   - Optional per-team branding
5. **Rules**
   - Optional rules text or supported document upload
6. **Team Signup**
   - Configure how league managers claim/access teams
7. **Complete**
   - Open the new league site or Commissioner Settings

The legacy **Admin Account** step is retired. The authenticated league creator is already the commissioner. Platform administration is managed separately from league setup.

## Setup progress compatibility

The canonical provider step key is `provider`.

Older LeagueZone setup records may contain `sleeper` in `config.completedSetupSteps`. The status API normalizes that legacy value to `provider` at read time, so existing in-progress setup sessions continue without a destructive data migration.

The obsolete `admin` step is ignored when setup progress is normalized.

## Creating additional leagues

Signed-in users can create more than one league.

Dashboard create actions use `/setup?new=1`. The first league-identity page intentionally starts blank in that mode rather than reusing the user's active completed league. Once the new league is created, the normal setup cookie and active-league cookie keep the remaining steps scoped to that new league.

Interrupted incomplete setup still resumes the user's in-progress league when `new=1` is not present.

## Provider data model

Provider-neutral season mappings live in `league_provider_seasons`.

- Each LeagueZone season maps to one provider and provider league ID.
- Historical seasons remain independently addressable.
- Sleeper legacy columns remain for compatibility but must not be used as the sole test for whether a league has a provider.
- Admin and operational views should resolve provider state from `league_provider_seasons`, with legacy Sleeper fields only as fallback for older records.

## Team access

League managers join through LeagueZone accounts and league invites/roster claims. Commissioner authority is derived from the league relationship, not from the global `users.role = 'admin'` platform-admin role.

## Security rules

- Every setup mutation requires an authenticated LeagueZone user.
- Setup mutations must verify ownership of the league being configured.
- League setup cannot create platform-admin users.
- Provider credentials and OAuth tokens remain server-side.
- Provider imports are collision-safe in both directions: Sleeper cannot overwrite Yahoo history, and Yahoo cannot overwrite Sleeper history or a different provider-season mapping.
