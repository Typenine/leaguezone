import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

async function verifyToken(token: string): Promise<'ok' | 'already_verified' | 'invalid'> {
  try {
    const db = getDb();

    // Look up the token
    const res = await db.execute(sql`
      SELECT id, user_id::text AS user_id, used_at
      FROM email_verification_tokens
      WHERE token = ${token}
        AND expires_at > NOW()
      LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (!rows[0]) return 'invalid';

    const row = rows[0];
    if (row.used_at) return 'already_verified';

    const userId = row.user_id as string;
    const tokenId = row.id as string;

    // Mark user as verified + mark token used (both in parallel)
    await Promise.all([
      db.execute(sql`
        UPDATE users SET email_verified = true WHERE id = ${userId}::uuid
      `),
      db.execute(sql`
        UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ${tokenId}::uuid
      `),
    ]);

    return 'ok';
  } catch {
    return 'invalid';
  }
}

export default async function VerifyEmailPage({ params }: PageProps) {
  const { token } = await params;
  const result = await verifyToken(token);

  if (result === 'ok') {
    // Verified — redirect to home with a success flag
    redirect('/home?verified=1');
  }

  // Show a user-facing error for invalid / expired tokens
  const isExpired = result === 'invalid';

  return (
    <div className="container mx-auto px-4 py-20 max-w-md text-center">
      <div className="text-5xl mb-4">{result === 'already_verified' ? '✅' : '❌'}</div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-2">
        {result === 'already_verified' ? 'Already verified' : 'Link invalid or expired'}
      </h1>
      <p className="text-[var(--muted)] mb-6 text-sm">
        {result === 'already_verified'
          ? 'Your email is already verified. You can sign in normally.'
          : isExpired
          ? 'This verification link has expired or already been used. Request a new one from your profile.'
          : 'Something went wrong. Try signing in and requesting a new verification email.'}
      </p>
      <Link
        href="/home"
        className="text-[var(--accent)] hover:underline text-sm"
      >
        Go to League Home →
      </Link>
    </div>
  );
}
