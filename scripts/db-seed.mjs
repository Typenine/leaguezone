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
  // Demo league — always ensure east-v-west exists (ON CONFLICT DO NOTHING is safe to run repeatedly).
  // Slug matches DEFAULT_LEAGUE_SLUG in src/lib/config/platform.ts.
  await sql`
    INSERT INTO leagues (slug, name, short_name, founded_year, setup_completed, is_active)
    VALUES ('east-v-west', 'East v. West', 'EvW', 2017, true, true)
    ON CONFLICT (slug) DO NOTHING;
  `;
  console.log('[db:seed] Ensured demo league east-v-west exists');
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
