/**
 * POST /api/feedback
 *
 * Beta feedback / bug reports / account-deletion requests from authenticated
 * testers. Intentionally reuses the existing `suggestions` table/pipeline
 * (see @/server/db/queries createSuggestion, and /admin/suggestions for how
 * commissioners already review it) instead of introducing a parallel
 * feedback/database system for the beta.
 *
 * Safe-by-construction context capture: we only attach the current page path
 * and the caller's own active league name (looked up server-side from their
 * own active_league_id cookie) — never cookies, tokens, or other secrets.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSuggestion } from '@/server/db/queries';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireAnySession, requireTeamUser } from '@/lib/server/session';
import { getUserById } from '@/lib/server/user-auth';
import { getKV } from '@/lib/server/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEEDBACK_CATEGORIES = new Set(['Beta Feedback', 'Account Deletion Request']);

async function getActiveLeague(): Promise<{ id: string; name: string } | null> {
  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value;
    if (!activeLeagueId) return null;
    const db = getDb();
    const res = await db.execute(sql`SELECT id::text AS id, name FROM leagues WHERE id = ${activeLeagueId}::uuid LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return row ? { id: row.id as string, name: row.name as string } : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAnySession();
    if (!session) {
      return NextResponse.json({ error: 'You must be signed in to send feedback.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 300) : '';
    const category = FEEDBACK_CATEGORIES.has(body.category) ? (body.category as string) : 'Beta Feedback';

    if (message.length < 3) {
      return NextResponse.json({ error: 'Please include a few more details.' }, { status: 400 });
    }
    if (message.length > 3000) {
      return NextResponse.json({ error: 'Message is too long (max 3000 characters).' }, { status: 400 });
    }

    // Best-effort per-user rate limit (fails open if KV isn't configured).
    try {
      const kv = await getKV();
      if (kv) {
        const key = `rl:feedback:${session.userId}`;
        const n = await kv.incr(key);
        if (kv.expire && n === 1) await kv.expire(key, 600);
        if (n > 10) {
          return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
        }
      }
    } catch {}

    // Identify the reporter for the admin-facing text (best-effort, never blocks submission).
    let reporterLabel = 'A tester';
    try {
      if (session.type === 'user') {
        const user = await getUserById(session.userId);
        if (user) reporterLabel = user.displayName || user.email;
      } else {
        const teamIdent = await requireTeamUser();
        if (teamIdent?.team) reporterLabel = teamIdent.team;
      }
    } catch {}

    const activeLeague = await getActiveLeague();

    const contextLines = [
      `Reported by: ${reporterLabel}`,
      pageUrl ? `Page: ${pageUrl}` : null,
      activeLeague ? `League: ${activeLeague.name}` : null,
    ].filter(Boolean);

    const text = `${contextLines.join('\n')}\n\n${message}`;

    const row = await createSuggestion({
      userId: session.type === 'user' ? session.userId : null,
      // Tag with the reporter's own active league (when they have one) so
      // that league's commissioner sees it in their existing suggestions
      // view; site-wide review of all leagues remains available via
      // /admin/suggestions with no active league selected.
      leagueId: activeLeague?.id || null,
      text,
      category,
    });

    if (!row) {
      return NextResponse.json({ error: 'Failed to save feedback.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (error) {
    console.error('POST /api/feedback failed', error);
    return NextResponse.json({ error: 'Failed to save feedback.' }, { status: 500 });
  }
}
