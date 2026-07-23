#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const MIGRATION_LOCK_NAME = 'leaguezone_schema_migrations_v1';

function checksum(text) {
  return createHash('sha256').update(text).digest('hex');
}

function useSsl(connectionString) {
  return !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
}

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

  const client = new Client({
    connectionString: url,
    ssl: useSsl(url) ? { rejectUnauthorized: false } : false,
  });

  let lockAcquired = false;
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_NAME]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migration_ledger (
        filename text PRIMARY KEY,
        checksum text,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`ALTER TABLE _migration_ledger ADD COLUMN IF NOT EXISTS checksum text`);

    const ledgerRes = await client.query(`SELECT filename, checksum FROM _migration_ledger`);
    const applied = new Map(ledgerRes.rows.map((row) => [row.filename, row.checksum]));

    let ranCount = 0;
    for (const filename of files) {
      const migrationPath = path.join(dir, filename);
      const sqlText = fs.readFileSync(migrationPath, 'utf8');
      const fileChecksum = checksum(sqlText);
      const recordedChecksum = applied.get(filename);

      if (applied.has(filename)) {
        if (recordedChecksum && recordedChecksum !== fileChecksum) {
          throw new Error(
            `Applied migration ${filename} has changed. Create a new migration instead of editing an applied file.`,
          );
        }
        if (!recordedChecksum) {
          await client.query(
            `UPDATE _migration_ledger SET checksum = $2 WHERE filename = $1`,
            [filename, fileChecksum],
          );
        }
        console.log(`[db:migrate] Skipping ${filename} (already applied)`);
        continue;
      }

      console.log(`[db:migrate] Applying ${filename} ...`);
      await client.query('BEGIN');
      try {
        await client.query(sqlText);
        await client.query(
          `INSERT INTO _migration_ledger (filename, checksum) VALUES ($1, $2)`,
          [filename, fileChecksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      console.log(`[db:migrate] Applied ${filename}`);
      ranCount += 1;
    }

    if (ranCount === 0) {
      console.log('[db:migrate] All migrations already applied. Nothing to do.');
    }
  } finally {
    if (lockAcquired) {
      await client
        .query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_NAME])
        .catch(() => {});
    }
    await client.end();
  }

  console.log('[db:migrate] Done.');
}

main().catch((error) => {
  console.error('[db:migrate] FATAL:', error);
  process.exit(1);
});
