# LeagueZone mobile companion

Branch: `feature/mobile-research-companion` (do not deploy until reviewed).

## Scope

- Shared mobile navigation: Home, Research, Search, Saved, My Leagues; existing
  league pages retain their full navigation under More.
- Universal search uses the locally published public research season and the
  signed-in account's own league list. No unauthenticated player-search database
  query, hidden crawler or provider call.
- Player watchlists and saved research views work in device storage. Signed-in
  accounts sync explicitly through `/api/me/research-library` when saving or
  opening the saved list; errors do not overwrite local copies.
- Research player profiles link to the member-authorized Roster Opportunity
  Finder. The player detail shows verified ownership even if the player is not
  currently an Opportunity Radar signal.
- Public research shell and requested public season files have bounded offline
  caches. User-specific API results, rosters, league HTML, credentials and
  private pages are never cached.
- Optional browser push subscriptions are user-scoped. Supported alerts:
  published rising/falling usage signals for watched players. The scheduled
  task uses the validated immutable R2 research snapshot, never speculative
  forecasts, and deduplicates by account/player/year/week/direction.

## Environment setup

A site operator must set all three environment variables before enabling push:

- `WEB_PUSH_VAPID_PUBLIC_KEY`: URL-safe base64 of the uncompressed
  65-byte P-256 public key.
- `WEB_PUSH_VAPID_PRIVATE_KEY`: URL-safe base64 of the 32-byte
  private key. This must remain server-only.
- `WEB_PUSH_VAPID_SUBJECT`: a `mailto:operator@example.com` value.

Generate the keypair locally with Node's built-in `crypto`, rather
than storing a private key in the repo. For example:

```js
const {generateKeyPairSync} = require('node:crypto');
const {publicKey, privateKey} = generateKeyPairSync('ec', {namedCurve:'prime256v1'});
const pub = publicKey.export({format:'jwk'});
const priv = privateKey.export({format:'jwk'});
const publicValue = Buffer.concat([
  Buffer.from([4]), Buffer.from(pub.x,'base64url'), Buffer.from(pub.y,'base64url')
]).toString('base64url');
console.log('PUBLIC:', publicValue);
console.log('PRIVATE:', priv.d); // Store as a secret, never print to shared logs.
```

The new `drizzle/0104_research_companion.sql` migration must run
before enabling authenticated saves or push. It adds compact user-owned tables
with FK cleanup and no duplicated NFL/roster datasets.

## Verification and rollout

1. Run typecheck, lint, unit tests, build with `SKIP_MIGRATION=true`,
   and desktop/Pixel 7 browser smoke tests.
2. Test anonymous search and local saves. Verify no unauthorized Neon queries
   or private roster results.
3. Test signed-in save/sync, migration idempotence and cross-user isolation in
   an isolated test database.
4. Test research-to-roster mapping with a Sleeper test league, Yahoo if
   connected, and unmapped/free-agent edge cases.
5. Deploy only after manual review. On a real Android and installed iOS web app,
   verify push permission, subscribe, test push, opt-out, and notification
   navigation. Actual delivery requires a valid VAPID keypair and device.
6. Monitor scheduled alert results and Vercel/Neon use. This implementation
   deliberately caps a run at 250 subscriptions; pagination is needed before
   any larger rollout.

## Not included

A personalized home feed, injury news alerts, league-trade notifications and
draft-clock notifications are not part of this batch. Their provider event
pipelines need independent implementation and privacy review.
