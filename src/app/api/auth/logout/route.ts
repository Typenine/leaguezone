import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const jar = await cookies();
  const clear = (name: string) => jar.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  clear('evw_session');
  clear('evw_pin_override');
  // Account-admin sessions may temporarily bridge older APIs through this
  // compatibility cookie. It must never survive a normal account logout.
  clear('evw_admin');

  return Response.json({ ok: true });
}
