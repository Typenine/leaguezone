import { neon } from '@neondatabase/serverless';

/**
 * Lightweight DB helper for e2e tests. Tests run against the real
 * DATABASE_URL (Neon), so every test that creates data MUST clean up after
 * itself via this helper — we never want onboarding-journey test runs to
 * leave fake users/leagues behind in a real environment.
 */
export function getTestDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required to run e2e tests that touch the database');
  }
  return neon(url);
}

export async function deleteTestUserAndLeagues(email: string) {
  const sql = getTestDb();
  const userRows = await sql`SELECT id::text AS id FROM users WHERE email = ${email} LIMIT 1`;
  const userId = userRows[0]?.id as string | undefined;
  if (!userId) return;

  const leagueRows = await sql`SELECT id::text AS id FROM leagues WHERE commissioner_user_id = ${userId}::uuid`;
  for (const row of leagueRows) {
    const leagueId = row.id as string;
    await sql`DELETE FROM league_invites WHERE league_id = ${leagueId}::uuid`;
    await sql`DELETE FROM newsletter_episodes WHERE league_id = ${leagueId}::uuid`;
    await sql`DELETE FROM leagues WHERE id = ${leagueId}::uuid`;
  }

  await sql`DELETE FROM email_verification_tokens WHERE user_id = ${userId}::uuid`;
  await sql`DELETE FROM password_reset_tokens WHERE user_id = ${userId}::uuid`;
  await sql`DELETE FROM users WHERE id = ${userId}::uuid`;
}
