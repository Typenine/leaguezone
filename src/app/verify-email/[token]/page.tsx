import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}

function safeNextPath(value: string | string[] | undefined): string | null {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

function loginUrl(nextPath: string | null, verified = false): string {
  const params = new URLSearchParams();
  if (verified) params.set('verified', '1');
  if (nextPath) params.set('next', nextPath);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

async function verifyToken(token: string): Promise<'ok' | 'already_verified' | 'invalid'> {
  try {
    const db = getDb();

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

export default async function VerifyEmailPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const nextPath = safeNextPath(query.next);
  const result = await verifyToken(token);

  if (result === 'ok') {
    redirect(loginUrl(nextPath, true));
  }

  return (
    <div className="container mx-auto px-4 py-20 max-w-md text-center">
      <div className="text-5xl mb-4">{result === 'already_verified' ? '✅' : '❌'}</div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-2">
        {result === 'already_verified' ? 'Already verified' : 'Link invalid or expired'}
      </h1>
      <p className="text-[var(--muted)] mb-6 text-sm">
        {result === 'already_verified'
          ? 'Your email is already verified. Sign in to continue.'
          : 'This verification link has expired or already been used. Request a new one to continue.'}
      </p>
      <Link
        href={result === 'already_verified' ? loginUrl(nextPath) : '/verify-email'}
        className="text-[var(--accent)] hover:underline text-sm"
      >
        {result === 'already_verified' ? 'Sign in →' : 'Request a new verification email →'}
      </Link>
    </div>
  );
}
