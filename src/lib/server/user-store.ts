import { TEAM_NAMES } from '@/lib/constants/league';
import { normalizeName } from '@/lib/constants/team-mapping';
import { getUserDoc as dbGetUserDoc, setUserDoc as dbSetUserDoc } from '@/server/db/queries';

export type TradeAsset =
  | { type: 'player'; playerId: string }
  | { type: 'pick'; year: number; round: number; originalTeam: string }
  | { type: 'faab'; amount?: number };

export type TradeWants = {
  text?: string;
  positions?: string[];
  contactMethod?: 'text' | 'discord' | 'snap' | 'sleeper';
  phone?: string;
  snap?: string;
  lastPublishedTradeBlock?: TradeAsset[];
};

export type UserDoc = {
  userId: string;
  leagueId?: string | null;
  team: string;
  version: number;
  updatedAt: string;
  tradeBlock?: TradeAsset[];
  tradeWants?: TradeWants;
  votes?: Record<string, Record<string, number>>;
};

function canonicalizeTeamName(name: string): string {
  const want = normalizeName(name);
  const found = TEAM_NAMES.find((t) => normalizeName(t) === want);
  return found || name;
}

export async function readUserDoc(userId: string, team: string, leagueId?: string | null): Promise<UserDoc> {
  try {
    const row = await dbGetUserDoc(userId, leagueId);
    if (row) {
      return {
        userId: row.userId as string,
        leagueId: (row.leagueId as string | null) ?? null,
        team: row.team as string,
        version: Number(row.version || 0),
        updatedAt: new Date(row.updatedAt as unknown as Date).toISOString(),
        tradeBlock: (row.tradeBlock as unknown as UserDoc['tradeBlock']) || undefined,
        tradeWants: (row.tradeWants as unknown as UserDoc['tradeWants']) || undefined,
        votes: (row.votes as unknown as UserDoc['votes']) || undefined,
      };
    }
  } catch {}
  return {
    userId,
    leagueId: leagueId ?? null,
    team: canonicalizeTeamName(team),
    version: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function writeUserDoc(doc: UserDoc): Promise<boolean> {
  try {
    await dbSetUserDoc({
      userId: doc.userId,
      leagueId: doc.leagueId ?? null,
      team: canonicalizeTeamName(doc.team),
      version: doc.version ?? 0,
      updatedAt: new Date(doc.updatedAt),
      votes: doc.votes ?? null,
      tradeBlock: (doc.tradeBlock as Array<Record<string, unknown>> | null) ?? null,
      tradeWants: (doc.tradeWants as unknown as Record<string, unknown> | null) ?? null,
    });
    return true;
  } catch {
    return false;
  }
}
