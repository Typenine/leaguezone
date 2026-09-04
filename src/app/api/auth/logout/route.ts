import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const jar = await cookies();
  const clear = (name: string, opts: { httpOnly?: boolean } = {}) => jar.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    ...opts,
  });

  clear('evw_session');
  clear('evw_pin_override');
  // Account-admin sessions may temporarily bridge older APIs through this
  // compatibility cookie. It must never survive a normal account logout.
  clear('evw_admin');
  // Clear league context too. Without this, a second person signing in on
  // the same device/browser after someone logs out could briefly inherit
  // the previous user's "active league" selection (harmless for server-side
  // authorization, which always re-checks membership, but confusing and
  // wrong for which league the UI defaults to).
  clear('active_league_id', { httpOnly: false });
  clear('setup_league_id');

  return Response.json({ ok: true });
}
