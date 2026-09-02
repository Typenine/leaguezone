import { getDb } from './client';
import { newsModeration } from './schema';
import { and, eq } from 'drizzle-orm';

export type NewsModerationRule = {
  id: string;
  leagueId: string;
  type: string;
  value: string;
  reason: string | null;
  createdAt: Date;
  createdBy: string | null;
};

export async function getNewsModerationRules(leagueId: string): Promise<NewsModerationRule[]> {
  const db = getDb();
  return db.select().from(newsModeration).where(eq(newsModeration.leagueId, leagueId)).orderBy(newsModeration.createdAt);
}

export async function addNewsModerationRule(params: {
  leagueId: string;
  type: 'hide_url' | 'block_match' | 'block_headline';
  value: string;
  reason?: string;
  createdBy?: string;
}): Promise<NewsModerationRule> {
  const db = getDb();
  const [row] = await db
    .insert(newsModeration)
    .values({
      leagueId: params.leagueId,
      type: params.type,
      value: params.value,
      reason: params.reason ?? null,
      createdBy: params.createdBy ?? null,
    })
    .returning();
  return row as NewsModerationRule;
}

export async function deleteNewsModerationRule(id: string, leagueId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(newsModeration).where(and(eq(newsModeration.id, id), eq(newsModeration.leagueId, leagueId))).returning();
  return result.length > 0;
}
