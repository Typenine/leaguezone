import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import {
  getUserById,
  verifyPassword,
  hashPassword,
  validatePassword,
} from '@/lib/server/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }

    const passErr = validatePassword(newPassword);
    if (passErr) return NextResponse.json({ error: passErr }, { status: 400 });

    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!user.passwordHash) {
      return NextResponse.json({ error: 'No password set on this account' }, { status: 400 });
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await getDb().execute(sql`
      UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}::uuid
    `);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/auth/change-password failed', e);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
