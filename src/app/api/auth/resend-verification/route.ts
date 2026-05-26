import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { getUserById, generateSecureToken } from '@/lib/server/user-auth';
import { sendEmailVerification } from '@/lib/server/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

    const db = getDb();

    // Invalidate old tokens
    await db.execute(sql`
      DELETE FROM email_verification_tokens
      WHERE user_id = ${user.id}::uuid AND used_at IS NULL
    `);

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO email_verification_tokens (user_id, token, expires_at)
      VALUES (${user.id}::uuid, ${token}, ${expiresAt.toISOString()}::timestamptz)
    `);

    const origin = req.nextUrl.origin;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
    await sendEmailVerification(user.email, `${siteUrl}/verify-email/${token}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/auth/resend-verification failed', e);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
