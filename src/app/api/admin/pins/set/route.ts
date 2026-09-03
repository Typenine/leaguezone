import { NextRequest } from 'next/server';
import { hashPin } from '@/lib/server/auth';
import { writeTeamPinWithError } from '@/lib/server/pins';
import { getConfiguredAdminSecret } from '@/lib/auth/admin';
import { isLeagueAdminRequest } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isAdmin(req: NextRequest): Promise<boolean> {
  if (await isLeagueAdminRequest(req)) return true;
  const adminSecret = getConfiguredAdminSecret();
  if (!adminSecret) return false;
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ') && auth.slice('Bearer '.length) === adminSecret) return true;
  const hdr = req.headers.get('x-admin-key');
  return Boolean(hdr && hdr === adminSecret);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return Response.json({ error: 'forbidden' }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({} as { team?: string; pin?: string }));
    const team = typeof body.team === 'string' ? body.team.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    if (!team || !/^[0-9]{4,12}$/.test(pin)) return Response.json({ error: 'bad_request' }, { status: 400 });
    const { hash, salt } = await hashPin(pin);
    const rec = { hash, salt, pinVersion: Date.now(), updatedAt: new Date().toISOString() };
    const res = await writeTeamPinWithError(team, rec);
    if (!res.ok) return Response.json({ error: `write_failed: ${res.error || 'unknown'}` }, { status: 500 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
}
