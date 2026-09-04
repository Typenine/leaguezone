import { NextRequest, NextResponse } from 'next/server';
import { isLeagueAdminRequest } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return NextResponse.json({ isAdmin: await isLeagueAdminRequest(req) });
}

export async function POST() {
  return NextResponse.json(
    { error: 'Legacy admin-key login has been retired. Sign in with an authorized LeagueZone account.' },
    { status: 410 },
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('evw_admin', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('site_admin', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
