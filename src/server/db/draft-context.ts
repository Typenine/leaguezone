import { sql } from 'drizzle-orm';
import { getDb } from './client';
import { getActiveQaSession } from '@/lib/server/qa-session';
import { ensureDraftTablesScoped, getActiveOrLatestDraftIdScoped } from './draft-scope-queries';

/**
 * Resolve the implicit draft for the current request while making rehearsal
 * isolation fail closed. A broken/expired rehearsal must never fall through to
 * a live league draft.
 */
export async function getActiveOrLatestDraftIdForRequest(): Promise<string | null> {
  await ensureDraftTablesScoped();
  const qa = await getActiveQaSession();
  if (qa?.mode === 'rehearsal') {
    if (!qa.draftId) return null;
    const res = await getDb().execute(sql`
      SELECT id::text AS id
      FROM drafts
      WHERE id = ${qa.draftId}::uuid
        AND league_id = ${qa.leagueId}::uuid
        AND environment = 'rehearsal'
        AND qa_session_id = ${qa.id}::uuid
      LIMIT 1
    `);
    return (res as unknown as { rows?: Array<{ id: string }> }).rows?.[0]?.id || null;
  }
  return getActiveOrLatestDraftIdScoped();
}
