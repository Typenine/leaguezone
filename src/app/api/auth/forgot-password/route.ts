import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { getUserByEmail, generateSecureToken } from '@/lib/server/user-auth';
import { sendPasswordResetEmail } from '@/lib/server/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Always return 200 — never reveal whether an email exists
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) return NextResponse.json({ ok: true });

    const user = await getUserByEmail(email);
    if (!user) return NextResponse.json({ ok: true });

    const db = getDb();

    // Invalidate previous unused tokens for this user
    await db.execute(sql`
      DELETE FROM password_reset_tokens
      WHERE user_id = ${user.id}::uuid AND used_at IS NULL
    `);

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.execute(sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}::uuid, ${token}, ${expiresAt.toISOString()}::timestamptz)
    `);

    const origin = req.nextUrl.origin;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
    const resetUrl = `${siteUrl}/reset-password/${token}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailErr) {
      console.error('Failed to send password reset email', emailErr);
      // Don't surface email errors to the client
    }
  } catch (e) {
    console.error('POST /api/auth/forgot-password failed', e);
  }

  return NextResponse.json({ ok: true });
}
