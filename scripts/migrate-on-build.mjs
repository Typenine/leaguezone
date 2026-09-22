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

async function vercelCommitTouchesMigrations() {
  if (process.env.VERCEL !== '1') return null;

  const owner = process.env.VERCEL_GIT_REPO_OWNER?.trim();
  const repo = process.env.VERCEL_GIT_REPO_SLUG?.trim();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (!owner || !repo || !sha) return null;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'leaguezone-vercel-build',
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      console.warn(`[migrate-on-build] Could not inspect commit files (GitHub HTTP ${response.status}). Falling back to normal migration execution.`);
      return null;
    }

    // GitHub paginates commit file lists above its per-response limit. If that
    // happens, be conservative and run migrations instead of assuming safety.
    if (response.headers.get('link')?.includes('rel="next"')) {
      console.warn('[migrate-on-build] Commit file list is paginated. Falling back to normal migration execution.');
      return null;
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.files)) return null;

    return payload.files.some((file) => {
      const filename = typeof file?.filename === 'string' ? file.filename : '';
      return filename.startsWith('drizzle/') && filename.endsWith('.sql');
    });
  } catch (error) {
    console.warn(
      '[migrate-on-build] Could not inspect commit files. Falling back to normal migration execution.',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

const touchesMigrations = await vercelCommitTouchesMigrations();
if (touchesMigrations === false) {
  console.log('[migrate-on-build] Vercel commit contains no drizzle/*.sql changes. Skipping db:migrate.');
  process.exit(0);
}

console.log(
  touchesMigrations === true
    ? '[migrate-on-build] Migration file changed in this commit. Running db:migrate...'
    : '[migrate-on-build] Migration impact unknown. Running db:migrate...',
);

try {
  execSync('npm run db:migrate', { stdio: 'inherit' });
  console.log('[migrate-on-build] Done.');
} catch (e) {
  console.error('[migrate-on-build] Migration FAILED. Aborting build.', e?.message || e);
  process.exit(1);
}
