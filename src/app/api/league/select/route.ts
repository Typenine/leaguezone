import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserLeagues } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';

async function resolveLeague(params: URLSearchParams) {
  const id = params.get('id')?.trim();
  const slug = params.get('slug')?.trim().toLowerCase();
  if (!id && !slug) return null;
  const db = getDb();
  const res = id
    ? await db.execute(sql`
        SELECT id::text AS id, slug
        FROM leagues
        WHERE setup_completed = true
          AND is_active = true
          AND id = ${id}::uuid
        LIMIT 1
      `)
    : await db.execute(sql`
        SELECT id::text AS id, slug
        FROM leagues
        WHERE setup_completed = true
          AND is_active = true
          AND slug = ${slug}
        LIMIT 1
      `);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? null;
}

function safeDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/home';
  return value;
}

/**
 * GET /api/league/select?id=[leagueId]&next=[path]
 * Sets the active league context and redirects to a local platform path.
 */
export async function GET(req: NextRequest) {
  const league = await resolveLeague(req.nextUrl.searchParams).catch(() => null);
  if (!league) return NextResponse.redirect(new URL('/', req.url));

  const id = league.id as string;
  const slug = league.slug as string;
  const token = req.cookies.get('evw_session')?.value || '';
  const claims = token ? verifySession(token) : null;
  const isAdmin = isAdminCookieValue(req.cookies.get('evw_admin')?.value)
    || isSiteAdminCookieValue(req.cookies.get('site_admin')?.value);

  if (claims?.type === 'user' && !isAdmin) {
    const userLeagues = await getUserLeagues(claims.sub as string);
    const hasMemberships = userLeagues.length > 0;
    const isMember = userLeagues.some((item) => item.leagueId === id);
    if (hasMemberships && !isMember) {
      return NextResponse.redirect(new URL(`/l/${slug}`, req.url));
    }
  }

  const destination = safeDestination(req.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(new URL(destination, req.url));
  res.cookies.set('active_league_id', id, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
