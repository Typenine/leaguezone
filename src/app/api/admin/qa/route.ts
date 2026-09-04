import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getAllLeagues } from '@/lib/server/league-config';
import { getLeagueById } from '@/lib/server/league-context';
import { getLeagueTeamOptions } from '@/lib/server/league-teams';
import { getConfiguredAdminSecret } from '@/lib/auth/admin';
import { getUnderlyingPlatformAdminUserFromRequest } from '@/lib/server/admin-auth';
import {
  QA_SESSION_COOKIE,
  QA_MODE_COOKIE,
  QA_PERSPECTIVE_COOKIE,
  QA_DRAFT_COOKIE,
  type QaMode,
  type QaPerspective,
  ensureQaSessionsTable,
  getActiveQaSessionFromRequest,
} from '@/lib/server/qa-session';
import {
  createRehearsalDraftForLeague,
  deleteRehearsalDraft,
  findLiveDraftForYear,
} from '@/server/db/draft-scope-queries';
import { copyDraftSetupMetadata } from '@/server/db/draft-setup-queries';
import { resetDraft } from '@/server/db/queries.fixed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERSPECTIVES: QaPerspective[] = ['public', 'member', 'team', 'commissioner'];
const MODES: QaMode[] = ['view', 'rehearsal'];
const QA_MAX_AGE = 60 * 60 * 8;

function clearCookie(res: NextResponse, name: string, httpOnly = true) {
  res.cookies.set(name, '', { httpOnly, sameSite: 'lax', path: '/', maxAge: 0 });
}

function applyQaCookies(res: NextResponse, session: {
  id: string;
  leagueId: string;
  perspective: QaPerspective;
  mode: QaMode;
  draftId?: string | null;
}) {
  const secure = process.env.NODE_ENV === 'production';
  const protectedOpts = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: QA_MAX_AGE };
  res.cookies.set(QA_SESSION_COOKIE, session.id, protectedOpts);
  res.cookies.set(QA_MODE_COOKIE, session.mode, protectedOpts);
  res.cookies.set(QA_PERSPECTIVE_COOKIE, session.perspective, protectedOpts);
  if (session.mode === 'rehearsal' && session.draftId) res.cookies.set(QA_DRAFT_COOKIE, session.draftId, protectedOpts);
  else clearCookie(res, QA_DRAFT_COOKIE);
  res.cookies.set('active_league_id', session.leagueId, { httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 30 });
  res.cookies.set('site_admin', '', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 0 });

  const legacySecret = getConfiguredAdminSecret();
  if (session.perspective === 'commissioner' && legacySecret) {
    res.cookies.set('evw_admin', legacySecret, { ...protectedOpts, maxAge: 60 * 60 * 24 * 30 });
  } else {
    clearCookie(res, 'evw_admin');
  }
}

function restoreAdminCookies(res: NextResponse) {
  clearCookie(res, QA_SESSION_COOKIE);
  clearCookie(res, QA_MODE_COOKIE);
  clearCookie(res, QA_PERSPECTIVE_COOKIE);
  clearCookie(res, QA_DRAFT_COOKIE);
  clearCookie(res, 'evw_preview');
  const legacySecret = getConfiguredAdminSecret();
  if (legacySecret) {
    res.cookies.set('evw_admin', legacySecret, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

async function ownedSession(sessionId: string, adminUserId: string) {
  const res = await getDb().execute(sql`
    SELECT q.*, l.slug AS league_slug, l.name AS league_name
    FROM qa_sessions q JOIN leagues l ON l.id = q.league_id
    WHERE q.id = ${sessionId}::uuid AND q.admin_user_id = ${adminUserId}::uuid
    LIMIT 1
  `);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] || null;
}

function serialize(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: String(row.id),
    leagueId: String(row.league_id),
    leagueSlug: String(row.league_slug),
    leagueName: String(row.league_name),
    perspective: String(row.perspective),
    teamName: row.team_name ? String(row.team_name) : null,
    rosterId: row.roster_id == null ? null : Number(row.roster_id),
    mode: String(row.mode),
    draftId: row.draft_id ? String(row.draft_id) : null,
    active: Boolean(row.active),
    expiresAt: new Date(row.expires_at as string | Date).toISOString(),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const admin = await getUnderlyingPlatformAdminUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Platform admin account required' }, { status: 403 });
  await ensureQaSessionsTable();

  const url = new URL(req.url);
  const leagueId = url.searchParams.get('leagueId') || '';
  const [leagues, active, recentRes, teams] = await Promise.all([
    getAllLeagues(),
    getActiveQaSessionFromRequest(req),
    getDb().execute(sql`
      SELECT q.*, l.slug AS league_slug, l.name AS league_name
      FROM qa_sessions q JOIN leagues l ON l.id = q.league_id
      WHERE q.admin_user_id = ${admin.id}::uuid
      ORDER BY q.updated_at DESC LIMIT 12
    `),
    leagueId ? getLeagueTeamOptions(leagueId) : Promise.resolve([]),
  ]);
  const recentRows = (recentRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return NextResponse.json({ leagues, active, recent: recentRows.map(serialize), teams });
}

export async function POST(req: NextRequest) {
  const admin = await getUnderlyingPlatformAdminUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Platform admin account required' }, { status: 403 });
  await ensureQaSessionsTable();

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : 'start';
  const db = getDb();

  if (action === 'end') {
    const activeId = req.cookies.get(QA_SESSION_COOKIE)?.value || '';
    if (activeId) {
      await db.execute(sql`
        UPDATE qa_sessions SET active = false, updated_at = now()
        WHERE id = ${activeId}::uuid AND admin_user_id = ${admin.id}::uuid
      `).catch(() => {});
    }
    const res = NextResponse.json({ ok: true, redirect: '/admin/qa' });
    restoreAdminCookies(res);
    return res;
  }

  if (action === 'delete') {
    const sessionId = String(body.sessionId || '');
    const row = await ownedSession(sessionId, admin.id);
    if (!row) return NextResponse.json({ error: 'QA session not found' }, { status: 404 });
    if (row.draft_id && row.mode === 'rehearsal') {
      await deleteRehearsalDraft(String(row.draft_id), sessionId).catch(() => {});
    }
    await db.execute(sql`DELETE FROM draft_workspace WHERE id = ${`qa:${sessionId}`}`).catch(() => {});
    await db.execute(sql`DELETE FROM qa_sessions WHERE id = ${sessionId}::uuid AND admin_user_id = ${admin.id}::uuid`);
    const res = NextResponse.json({ ok: true });
    if (req.cookies.get(QA_SESSION_COOKIE)?.value === sessionId) restoreAdminCookies(res);
    return res;
  }

  if (action === 'reset') {
    const sessionId = String(body.sessionId || req.cookies.get(QA_SESSION_COOKIE)?.value || '');
    const row = await ownedSession(sessionId, admin.id);
    if (!row || row.mode !== 'rehearsal' || !row.draft_id) {
      return NextResponse.json({ error: 'Rehearsal session not found' }, { status: 404 });
    }
    await resetDraft(String(row.draft_id));
    return NextResponse.json({ ok: true });
  }

  if (action === 'resume') {
    const sessionId = String(body.sessionId || '');
    const row = await ownedSession(sessionId, admin.id);
    if (!row || new Date(row.expires_at as string | Date).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'QA session is unavailable or expired' }, { status: 404 });
    }
    await db.execute(sql`UPDATE qa_sessions SET active = false WHERE admin_user_id = ${admin.id}::uuid`);
    await db.execute(sql`UPDATE qa_sessions SET active = true, updated_at = now() WHERE id = ${sessionId}::uuid`);
    const res = NextResponse.json({ ok: true, session: serialize({ ...row, active: true }), redirect: row.mode === 'rehearsal' ? '/draft/room' : `/l/${row.league_slug}` });
    applyQaCookies(res, { id: sessionId, leagueId: String(row.league_id), perspective: row.perspective as QaPerspective, mode: row.mode as QaMode, draftId: row.draft_id ? String(row.draft_id) : null });
    return res;
  }

  if (action === 'update') {
    const sessionId = String(body.sessionId || req.cookies.get(QA_SESSION_COOKIE)?.value || '');
    const row = await ownedSession(sessionId, admin.id);
    if (!row) return NextResponse.json({ error: 'QA session not found' }, { status: 404 });
    const perspective = PERSPECTIVES.includes(body.perspective as QaPerspective) ? body.perspective as QaPerspective : row.perspective as QaPerspective;
    const teams = await getLeagueTeamOptions(String(row.league_id));
    const selected = teams.find((team) => team.teamName === body.teamName || team.rosterId === Number(body.rosterId));
    if ((perspective === 'team' || perspective === 'member') && !selected) {
      return NextResponse.json({ error: 'Choose a league team for this perspective' }, { status: 400 });
    }
    await db.execute(sql`
      UPDATE qa_sessions SET perspective = ${perspective}, team_name = ${selected?.teamName ?? null},
        roster_id = ${selected?.rosterId ?? null}, active = true, updated_at = now()
      WHERE id = ${sessionId}::uuid
    `);
    const res = NextResponse.json({ ok: true, redirect: row.mode === 'rehearsal' ? '/draft/room' : `/l/${row.league_slug}` });
    applyQaCookies(res, { id: sessionId, leagueId: String(row.league_id), perspective, mode: row.mode as QaMode, draftId: row.draft_id ? String(row.draft_id) : null });
    return res;
  }

  const leagueId = String(body.leagueId || '');
  const league = await getLeagueById(leagueId);
  if (!league) return NextResponse.json({ error: 'Choose a valid league' }, { status: 400 });
  const perspective = PERSPECTIVES.includes(body.perspective as QaPerspective) ? body.perspective as QaPerspective : 'team';
  const mode = MODES.includes(body.mode as QaMode) ? body.mode as QaMode : 'view';
  const teams = await getLeagueTeamOptions(leagueId);
  const selected = teams.find((team) => team.teamName === body.teamName || team.rosterId === Number(body.rosterId));
  if ((perspective === 'team' || perspective === 'member') && !selected) {
    return NextResponse.json({ error: 'Choose a league team for this perspective' }, { status: 400 });
  }
  if (mode === 'rehearsal' && teams.length === 0) {
    return NextResponse.json({ error: 'This league has no team data available for a draft rehearsal' }, { status: 400 });
  }

  await db.execute(sql`UPDATE qa_sessions SET active = false WHERE admin_user_id = ${admin.id}::uuid`);
  const insert = await db.execute(sql`
    INSERT INTO qa_sessions (admin_user_id, league_id, perspective, team_name, roster_id, mode, active, expires_at)
    VALUES (${admin.id}::uuid, ${leagueId}::uuid, ${perspective}, ${selected?.teamName ?? null}, ${selected?.rosterId ?? null}, ${mode}, true, now() + interval '8 hours')
    RETURNING id::text AS id
  `);
  const sessionId = (insert as unknown as { rows?: Array<{ id: string }> }).rows?.[0]?.id;
  if (!sessionId) return NextResponse.json({ error: 'Could not create QA session' }, { status: 500 });

  let draftId: string | null = null;
  try {
    if (mode === 'rehearsal') {
      const year = Math.max(2000, Math.min(2200, Number(body.year || new Date().getFullYear() + 1)));
      const rounds = Math.max(1, Math.min(20, Number(body.rounds || 4)));
      const clockSeconds = Math.max(10, Math.min(86400, Number(body.clockSeconds || 60)));
      const requestedSource = typeof body.sourceDraftId === 'string' ? body.sourceDraftId : '';
      const sourceDraftId = requestedSource || await findLiveDraftForYear(leagueId, year);
      draftId = await createRehearsalDraftForLeague({
        leagueId,
        qaSessionId: sessionId,
        year,
        rounds,
        teams: teams.map((team) => team.teamName),
        clockSeconds,
        sourceDraftId,
      });
      if (sourceDraftId) await copyDraftSetupMetadata(sourceDraftId, draftId);
      await db.execute(sql`UPDATE qa_sessions SET draft_id = ${draftId}::uuid, updated_at = now() WHERE id = ${sessionId}::uuid`);
    }
  } catch (error) {
    if (draftId) await deleteRehearsalDraft(draftId, sessionId).catch(() => {});
    await db.execute(sql`DELETE FROM qa_sessions WHERE id = ${sessionId}::uuid`).catch(() => {});
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create rehearsal' }, { status: 500 });
  }

  const redirect = mode === 'rehearsal' ? '/draft/room' : `/l/${league.slug}`;
  const res = NextResponse.json({ ok: true, sessionId, draftId, redirect });
  applyQaCookies(res, { id: sessionId, leagueId, perspective, mode, draftId });
  return res;
}
