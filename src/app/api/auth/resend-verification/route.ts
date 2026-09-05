import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  getUserByEmail,
  generateSecureToken,
  validateEmail,
} from '@/lib/server/user-auth';
import { sendEmailVerification } from '@/lib/server/email';
import { rateLimitByIp, AUTH_RATE_LIMITS } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

function verificationUrl(siteUrl: string, token: string, nextPath: string | null): string {
  const url = new URL(`/verify-email/${token}`, siteUrl);
  if (nextPath) url.searchParams.set('next', nextPath);
  return url.toString();
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = await rateLimitByIp(ip, 'resend-verification', AUTH_RATE_LIMITS.resendVerification);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many verification email requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const nextPath = safeNextPath(body.next);

    const validationError = validateEmail(email);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const user = await getUserByEmail(email);

    // Always return the same successful shape for unknown, grandfathered, or
    // already verified accounts so this endpoint cannot be used to enumerate users.
    if (!user || !user.emailVerificationRequired || user.emailVerified) {
      return NextResponse.json({ ok: true });
    }

    const db = getDb();
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
    await sendEmailVerification(user.email, verificationUrl(siteUrl, token, nextPath));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/auth/resend-verification failed', e);
    return NextResponse.json(
      { error: 'Verification email could not be sent. Please try again shortly.' },
      { status: 500 },
    );
  }
}
