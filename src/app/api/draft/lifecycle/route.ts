import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getCurrentLeague } from '@/lib/server/league-context';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getDb } from '@/server/db/client';

export const dynamic = 'force-dynamic';
const STATES = ['scheduled', 'open', 'paused', 'complete', 'archived'] as const;

export async function GET() {
  const league = await getCurrentLeague();
  if (!league) return Response.json({ error: 'No active league selected' }, { status: 403 });
  const membership = await getActiveLeagueMembership(league.id);
  if (!membership.ok) return Response.json({ error: membership.error }, { status: membership.status });
  const draft = (league.config.draftLifecycle || {}) as Record<string, unknown>;
  const dates = (league.config.importantDates || {}) as Record<string, unknown>;
  return Response.json({ state: STATES.includes(draft.state as typeof STATES[number]) ? draft.state : 'scheduled', date: draft.date || dates.nextDraft || null, location: draft.location || '', canManage: membership.membership.isCommissioner });
}

export async function POST(request: NextRequest) {
  const league = await getCurrentLeague();
  if (!league) return Response.json({ error: 'No active league selected' }, { status: 403 });
  const membership = await getActiveLeagueMembership(league.id);
  if (!membership.ok || !membership.membership.isCommissioner) return Response.json({ error: 'Commissioner access required' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const state = STATES.includes(body.state) ? body.state : null;
  if (!state) return Response.json({ error: 'Invalid draft state' }, { status: 400 });
  const date = typeof body.date === 'string' && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date).toISOString() : null;
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, 200) : '';
  const nextConfig = { ...league.config, draftLifecycle: { state, date, location } };
  await getDb().execute(sql`UPDATE leagues SET config = ${JSON.stringify(nextConfig)}::jsonb, updated_at = now() WHERE id = ${league.id}::uuid`);
  return Response.json({ state, date, location, canManage: true });
}
