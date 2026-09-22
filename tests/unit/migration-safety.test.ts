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

  it('does not wake production Postgres for Vercel code-only commits', () => {
    const migrator = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'migrate-on-build.mjs'),
      'utf8',
    );
    expect(migrator).toContain('VERCEL_GIT_COMMIT_SHA');
    expect(migrator).toContain("filename.startsWith('drizzle/')");
    expect(migrator).toContain('touchesMigrations === false');
    expect(migrator).toContain('Skipping db:migrate');
    expect(migrator).toContain('Falling back to normal migration execution');
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

  it('grandfathers existing users while requiring verification for new inserts', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'drizzle', '0100_email_verification_enforcement.sql'),
      'utf8',
    );
    expect(sql).toContain('SET email_verification_required = false');
    expect(sql).toContain('ALTER COLUMN email_verification_required SET DEFAULT true');
    expect(sql).toContain('ALTER COLUMN email_verification_required SET NOT NULL');
  });
});
