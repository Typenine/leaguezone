import { NextResponse } from 'next/server';
import { GET as getRosters } from '@/app/api/export/rosters/route';
import { GET as getRules } from '@/app/api/export/rules/route';
import { GET as getDrafts } from '@/app/api/export/drafts/route';
import { GET as getHistory } from '@/app/api/export/history/route';
import { GET as getTrades } from '@/app/api/export/trades/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlayerEntity = {
  idx: number;
  playerId: string;
  name: string;
  position: string | null;
  nflTeam: string | null;
};

type TeamEntity = {
  idx: number;
  team: string;
};

type PlayerInfoMeta = {
  name?: string;
  position?: string | null;
  nflTeam?: string | null;
};

function buildEntitiesIndex(payload: Record<string, unknown>): { players: PlayerEntity[]; teams: TeamEntity[] } | undefined {
  try {
    const rosters = payload.rosters as unknown as {
      playerInfo?: Record<string, PlayerInfoMeta>;
      teamsBySeason?: Record<string, Array<{ teamName?: string }>>;
    } | null;
    if (!rosters) return undefined;

    const players: PlayerEntity[] = [];
    const info = rosters.playerInfo;
    if (info && typeof info === 'object') {
      let idx = 0;
      const typedInfo = info as Record<string, PlayerInfoMeta>;
      for (const [pid, meta] of Object.entries(typedInfo)) {
        const name = meta.name ?? pid;
        const position = meta.position ?? null;
        const nflTeam = meta.nflTeam ?? null;
        players.push({ idx, playerId: pid, name, position, nflTeam });
        idx += 1;
      }
    }

    const teamSet = new Set<string>();
    const teamsBySeason = rosters.teamsBySeason;
    if (teamsBySeason && typeof teamsBySeason === 'object') {
      for (const seasonTeams of Object.values(teamsBySeason) as Array<unknown>) {
        if (!Array.isArray(seasonTeams)) continue;
        for (const team of seasonTeams as Array<{ teamName?: string }>) {
          const name = team?.teamName;
          if (typeof name === 'string' && name.trim().length > 0) {
            teamSet.add(name);
          }
        }
      }
    }

    const teams: TeamEntity[] = Array.from(teamSet)
      .sort((a, b) => a.localeCompare(b))
      .map((name, idx) => ({ idx, team: name }));

    if (!players.length && !teams.length) return undefined;
    return { players, teams };
  } catch {
    return undefined;
  }
}

export async function GET() {
  try {
    const handlers: Record<string, () => Promise<Response>> = {
      rosters: () => getRosters(),
      rules: () => getRules(),
      drafts: () => getDrafts(),
      history: () => getHistory(),
      trades: () => getTrades(),
    };

    const entries = Object.entries(handlers);
    const settled = await Promise.allSettled(
      entries.map(async ([key, handler]) => {
        try {
          const response = await handler();
          const json = await response.json().catch(() => null as unknown);
          if (json === null) {
            return {
              key,
              data: null as unknown,
              error: `Failed to parse JSON from ${key} export handler`,
            };
          }
          return { key, data: json as unknown, error: null as string | null };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            key,
            data: null as unknown,
            error: `Export handler for ${key} failed: ${message}`,
          };
        }
      }),
    );

    const payload: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    settled.forEach((result, idx) => {
      const [key] = entries[idx];
      if (result.status === 'fulfilled') {
        const { data, error } = result.value;
        payload[key] = data;
        if (error) errors[key] = error;
      } else {
        payload[key] = null;
        errors[key] = result.reason instanceof Error ? result.reason.message : String(result.reason);
      }
    });

    const body = {
      meta: {
        type: 'full-league-export',
        version: 1,
        generatedAt: new Date().toISOString(),
      },
      ...payload,
      entities: buildEntitiesIndex(payload),
      errors: Object.keys(errors).length ? errors : undefined,
    };

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="league-export-all.json"',
      },
    });
  } catch (error) {
    console.error('export/all GET error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
