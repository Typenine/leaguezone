import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  createUser,
  getUserByEmail,
  validateEmail,
  validatePassword,
  validateDisplayName,
  generateSecureToken,
} from '@/lib/server/user-auth';
import { sendEmailVerification } from '@/lib/server/email';
import { rateLimitByIp, AUTH_RATE_LIMITS } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeNextPath(inviteCode: string): string | null {
  if (!inviteCode) return null;
  return `/join/${encodeURIComponent(inviteCode)}`;
}

function verificationUrl(siteUrl: string, token: string, nextPath: string | null): string {
  const url = new URL(`/verify-email/${token}`, siteUrl);
  if (nextPath) url.searchParams.set('next', nextPath);
  return url.toString();
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limit = await rateLimitByIp(ip, 'register', AUTH_RATE_LIMITS.register);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';

    const emailErr = validateEmail(email);
    if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

    const nameErr = validateDisplayName(displayName);
    if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

    const passErr = validatePassword(password);
    if (passErr) return NextResponse.json({ error: passErr }, { status: 400 });

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
    }

    const user = await createUser(email, displayName, password);
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await getDb().execute(sql`
      INSERT INTO email_verification_tokens (user_id, token, expires_at)
      VALUES (${user.id}::uuid, ${token}, ${expiresAt.toISOString()}::timestamptz)
    `);

    const origin = req.nextUrl.origin;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
    const nextPath = safeNextPath(inviteCode);

    try {
      await sendEmailVerification(user.email, verificationUrl(siteUrl, token, nextPath));
    } catch (emailErr) {
      console.error('Failed to send verification email', emailErr);
      return NextResponse.json(
        {
          error: 'Your account was created, but the verification email could not be sent. Request a new verification email to continue.',
          code: 'VERIFICATION_EMAIL_FAILED',
          verificationRequired: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        verificationRequired: true,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('POST /api/auth/register failed', e);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
