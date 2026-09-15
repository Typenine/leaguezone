import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { leagues, users } from './schema';

export const providerAccounts = pgTable('provider_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 32 }).notNull(),
  providerUserId: varchar('provider_user_id', { length: 255 }),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userProviderUnique: uniqueIndex('provider_accounts_user_provider_uidx').on(t.userId, t.provider),
  providerUserIdx: index('provider_accounts_provider_user_idx').on(t.provider, t.providerUserId),
}));

export const leagueProviderSeasons = pgTable('league_provider_seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  season: integer('season').notNull(),
  provider: varchar('provider', { length: 32 }).notNull(),
  providerLeagueId: varchar('provider_league_id', { length: 255 }).notNull(),
  providerGameId: varchar('provider_game_id', { length: 255 }),
  isCurrent: boolean('is_current').default(false).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  leagueSeasonUnique: uniqueIndex('league_provider_seasons_league_season_uidx').on(t.leagueId, t.season),
  providerLeagueIdx: index('league_provider_seasons_provider_league_idx').on(t.provider, t.providerLeagueId),
  leagueCurrentIdx: index('league_provider_seasons_league_current_idx').on(t.leagueId, t.isCurrent),
}));

export const providerLeagueSnapshots = pgTable('provider_league_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  leagueProviderSeasonId: uuid('league_provider_season_id').notNull().references(() => leagueProviderSeasons.id, { onDelete: 'cascade' }),
  snapshotType: varchar('snapshot_type', { length: 64 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown> | Array<Record<string, unknown>>>().notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => ({
  seasonTypeUnique: uniqueIndex('provider_league_snapshots_season_type_uidx').on(t.leagueProviderSeasonId, t.snapshotType),
  fetchedIdx: index('provider_league_snapshots_fetched_idx').on(t.fetchedAt),
}));
