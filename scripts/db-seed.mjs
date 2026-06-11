#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[db:seed] DATABASE_URL missing');
    process.exit(1);
  }
  const sql = neon(url);
  // Default league — seeded only when no leagues exist yet, so the setup
  // wizard still runs normally on fresh installs that skip seeding.
  // Slug matches DEFAULT_LEAGUE_SLUG in src/lib/config/platform.ts.
  const existingLeagues = await sql`SELECT count(*)::int AS count FROM leagues;`;
  if ((existingLeagues[0]?.count ?? 0) === 0) {
    await sql`
      INSERT INTO leagues (slug, name, short_name, founded_year, setup_completed, is_active)
      VALUES ('east-v-west', 'East v. West', 'EvW', 2017, true, true)
      ON CONFLICT (slug) DO NOTHING;
    `;
    console.log('[db:seed] Seeded default league east-v-west');
  }
  // users
  await sql`INSERT INTO users (email, display_name, role) VALUES ('admin@evw.local','Admin','admin') ON CONFLICT (email) DO NOTHING;`;
  // teams
  await sql`INSERT INTO teams (name, abbrev) VALUES ('East All-Stars','EAS') ON CONFLICT (abbrev) DO NOTHING;`;
  await sql`INSERT INTO teams (name, abbrev) VALUES ('West All-Stars','WES') ON CONFLICT (abbrev) DO NOTHING;`;
  // players
  await sql`INSERT INTO players (name, position, nfl_team) VALUES ('John Doe','QB','NE') ON CONFLICT DO NOTHING;`;
  await sql`INSERT INTO players (name, position, nfl_team) VALUES ('Max Speed','RB','KC') ON CONFLICT DO NOTHING;`;
  console.log('[db:seed] Seeded minimal data');
}

main().catch((e) => { console.error(e); process.exit(1); });
