import { NextRequest, NextResponse } from 'next/server';
import { isUnderlyingPlatformAdminRequest } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const isAdmin = await isUnderlyingPlatformAdminRequest(req);
  return NextResponse.json({ isSiteAdmin: isAdmin, isAdmin });
}

export async function POST() {
  return NextResponse.json(
    { error: 'Legacy super-admin key login has been retired. Sign in with a platform-admin LeagueZone account.' },
    { status: 410 },
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('site_admin', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('evw_admin', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
