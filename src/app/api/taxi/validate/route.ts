import { NextRequest } from 'next/server';
import { validateTaxiForRoster } from '@/lib/server/taxi-validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const season = url.searchParams.get('season') || String(new Date().getFullYear());
  const rosterId = Number(url.searchParams.get('rosterId') || '0');
  if (!Number.isFinite(rosterId) || rosterId <= 0) {
    return Response.json({ error: 'invalid_roster' }, { status: 400 });
  }

  try {
    const result = await validateTaxiForRoster(season, rosterId);
    if (!result) {
      return Response.json({
        team: { teamName: `Roster ${rosterId}`, rosterId, selectedSeason: String(season) },
        current: { taxi: [], counts: { total: 0, qbs: 0 } },
        compliant: true,
        violations: [],
      });
    }
    return Response.json(result);
  } catch {
    return Response.json({
      team: { teamName: `Roster ${rosterId}`, rosterId, selectedSeason: String(season) },
      current: { taxi: [], counts: { total: 0, qbs: 0 } },
      compliant: true,
      violations: [],
      note: 'fallback_empty_due_to_error',
    });
  }
}
