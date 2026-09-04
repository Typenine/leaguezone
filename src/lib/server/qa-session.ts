import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { verifySession } from '@/lib/server/auth';

export const QA_SESSION_COOKIE = 'lz_qa_session';
export const QA_MODE_COOKIE = 'lz_qa_mode';
export const QA_PERSPECTIVE_COOKIE = 'lz_qa_perspective';
export const QA_DRAFT_COOKIE = 'lz_qa_draft_id';
export const ADMIN_DRAFT_COOKIE = 'lz_admin_draft_id';

export type QaPerspective = 'public' | 'member' | 'team' | 'commissioner';
export type QaMode = 'view' | 'rehearsal';

export type QaSession = {
  id: string;
  adminUserId: string;
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  perspective: QaPerspective;
  teamName: string | null;
  rosterId: number | null;
  mode: QaMode;
  draftId: string | null;
  active: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

let qaTableEnsured = false;

/**
 * Keep QA usable even before the formal migration has been applied to an
 * existing LeagueZone database. The checked-in migration remains the schema
 * source of truth; this mirrors the project's existing lazy draft-table pattern.
 */
export async function ensureQaSessionsTable(): Promise<void> {
  if (qaTableEnsured) return;
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS qa_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      perspective varchar(24) NOT NULL,
      team_name varchar(255),
      roster_id integer,
      mode varchar(16) NOT NULL DEFAULT 'view',
      draft_id uuid,
      active boolean NOT NULL DEFAULT true,
      expires_at timestamptz NOT NULL DEFAULT (now() + interval '8 hours'),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS qa_sessions_admin_active_idx ON qa_sessions(admin_user_id, active, updated_at DESC)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS qa_sessions_league_idx ON qa_sessions(league_id, updated_at DESC)`).catch(() => {});
  qaTableEnsured = true;
}

function rowToSession(row: Record<string, unknown>): QaSession {
  return {
    id: String(row.id),
    adminUserId: String(row.admin_user_id),
    leagueId: String(row.league_id),
    leagueSlug: String(row.league_slug),
    leagueName: String(row.league_name),
    perspective: row.perspective as QaPerspective,
    teamName: row.team_name ? String(row.team_name) : null,
    rosterId: row.roster_id == null ? null : Number(row.roster_id),
    mode: row.mode as QaMode,
    draftId: row.draft_id ? String(row.draft_id) : null,
    active: Boolean(row.active),
    expiresAt: new Date(row.expires_at as string | Date).toISOString(),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  };
}

async function loadSession(sessionId: string, userId: string): Promise<QaSession | null> {
  if (!sessionId || !userId) return null;
  try {
    await ensureQaSessionsTable();
    const res = await getDb().execute(sql`
      SELECT q.*, l.slug AS league_slug, l.name AS league_name
      FROM qa_sessions q
      JOIN leagues l ON l.id = q.league_id
      WHERE q.id = ${sessionId}::uuid
        AND q.admin_user_id = ${userId}::uuid
        AND q.active = true
        AND q.expires_at > now()
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return row ? rowToSession(row) : null;
  } catch {
    return null;
  }
}

function userIdFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const claims = verifySession(token);
  if (!claims || claims.type !== 'user' || typeof claims.sub !== 'string') return null;
  return claims.sub;
}

export async function getActiveQaSessionForUser(userId: string): Promise<QaSession | null> {
  try {
    const jar = await cookies();
    const sessionId = jar.get(QA_SESSION_COOKIE)?.value || '';
    return loadSession(sessionId, userId);
  } catch {
    return null;
  }
}

export async function getActiveQaSession(): Promise<QaSession | null> {
  try {
    const jar = await cookies();
    const userId = userIdFromToken(jar.get('evw_session')?.value);
    if (!userId) return null;
    return loadSession(jar.get(QA_SESSION_COOKIE)?.value || '', userId);
  } catch {
    return null;
  }
}

export async function getActiveQaSessionFromRequest(req: NextRequest): Promise<QaSession | null> {
  const userId = userIdFromToken(req.cookies.get('evw_session')?.value);
  if (!userId) return null;
  return loadSession(req.cookies.get(QA_SESSION_COOKIE)?.value || '', userId);
}
