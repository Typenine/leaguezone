import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { leagues } from './schema';

/**
 * Season-scoped franchise identity and visual branding.
 * franchiseKey defaults to `roster:<id>` so a change in owner does not create a new franchise.
 */
export const franchiseBrandHistory = pgTable('franchise_brand_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  franchiseKey: varchar('franchise_key', { length: 128 }).notNull(),
  season: integer('season').notNull(),
  rosterId: integer('roster_id'),
  sleeperOwnerId: varchar('sleeper_owner_id', { length: 64 }),
  teamName: varchar('team_name', { length: 255 }).notNull(),
  abbreviation: varchar('abbreviation', { length: 32 }),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 16 }),
  secondaryColor: varchar('secondary_color', { length: 16 }),
  tertiaryColor: varchar('tertiary_color', { length: 16 }),
  quaternaryColor: varchar('quaternary_color', { length: 16 }),
  source: varchar('source', { length: 32 }).notNull().default('leaguezone'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  leagueSeasonIdx: index('franchise_brand_history_league_season_idx').on(t.leagueId, t.season),
  ownerIdx: index('franchise_brand_history_owner_idx').on(t.leagueId, t.sleeperOwnerId, t.season),
  rosterIdx: index('franchise_brand_history_roster_idx').on(t.leagueId, t.rosterId, t.season),
  uniqueSeason: uniqueIndex('franchise_brand_history_unique').on(t.leagueId, t.franchiseKey, t.season),
}));
