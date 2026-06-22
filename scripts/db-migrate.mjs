#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[db:migrate] DATABASE_URL missing');
    process.exit(1);
  }
  const dir = path.join(process.cwd(), 'drizzle');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.sql')).sort()
    : [];
  if (files.length === 0) {
    console.log('[db:migrate] No SQL files found in drizzle/. Nothing to do.');
    return;
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // Ensure ledger table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migration_ledger (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Fetch already-applied migrations
    const ledgerRes = await client.query(`SELECT filename FROM _migration_ledger`);
    const applied = new Set(ledgerRes.rows.map((r) => r.filename));

    let ranCount = 0;
    for (const f of files) {
      if (applied.has(f)) {
        console.log(`[db:migrate] Skipping ${f} (already applied)`);
        continue;
      }
      const p = path.join(dir, f);
      const sqlText = fs.readFileSync(p, 'utf8');
      console.log(`[db:migrate] Applying ${f} ...`);
      await client.query(sqlText);
      await client.query(`INSERT INTO _migration_ledger (filename) VALUES ($1)`, [f]);
      console.log(`[db:migrate] Applied ${f}`);
      ranCount++;
    }
    if (ranCount === 0) {
      console.log('[db:migrate] All migrations already applied. Nothing to do.');
    }
  } finally {
    await client.end();
  }
  console.log('[db:migrate] Done.');
}

main().catch((e) => { console.error('[db:migrate] FATAL:', e); process.exit(1); });
