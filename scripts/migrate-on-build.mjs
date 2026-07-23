#!/usr/bin/env node
import { execSync } from 'node:child_process';

if (process.env.SKIP_MIGRATION === 'true' || process.env.SKIP_MIGRATION === '1') {
  console.log('[migrate-on-build] SKIP_MIGRATION enabled. Skipping db:migrate.');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.log('[migrate-on-build] No DATABASE_URL found. Skipping db:migrate.');
  process.exit(0);
}

console.log('[migrate-on-build] Running db:migrate...');
try {
  execSync('npm run db:migrate', { stdio: 'inherit' });
  console.log('[migrate-on-build] Done.');
} catch (e) {
  console.error('[migrate-on-build] Migration FAILED. Aborting build.', e?.message || e);
  process.exit(1);
}
