import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  hashPassword,
  signUserSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  validatePassword,
} from '@/lib/server/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

    const passErr = validatePassword(password);
    if (passErr) return NextResponse.json({ error: passErr }, { status: 400 });

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    const db = getDb();

    // Look up the token
    const res = await db.execute(sql`
      SELECT id, user_id::text AS user_id
      FROM password_reset_tokens
      WHERE token = ${token}
        AND used_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (!rows[0]) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }
    const tokenId = rows[0].id as string;
    const userId = rows[0].user_id as string;

    // Update password
    const newHash = await hashPassword(password);
    await db.execute(sql`
      UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}::uuid
    `);

    // Mark token used
    await db.execute(sql`
      UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${tokenId}::uuid
    `);

    // Sign a new session so the user is instantly logged in
    const sessionToken = signUserSession(userId);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/auth/reset-password failed', e);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
