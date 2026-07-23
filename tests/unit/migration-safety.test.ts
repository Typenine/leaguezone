import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration deployment safety', () => {
  it('stops the production build when migration execution fails', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).toBe('node scripts/migrate-on-build.mjs && next build');
  });

  it('keeps the pre-ledger newsletter migration idempotent', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'drizzle', '0007_newsletter_episodes.sql'),
      'utf8',
    );
    expect(sql).toContain('WHEN duplicate_object THEN NULL');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS newsletter_episodes');
  });

  it('records checksums and applies each migration transactionally', () => {
    const migrator = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'db-migrate.mjs'),
      'utf8',
    );
    expect(migrator).toContain("createHash('sha256')");
    expect(migrator).toContain("await client.query('BEGIN')");
    expect(migrator).toContain("await client.query('ROLLBACK')");
    expect(migrator).toContain('pg_advisory_lock');
  });
});
