import { getCurrentLeague } from '@/lib/server/league-context';
import { getActiveQaSession } from '@/lib/server/qa-session';

export async function isDraftLifecycleOpen(): Promise<boolean> {
  // Rehearsal drafts are intentionally isolated from the live league draft lifecycle.
  // A team-perspective QA session must be able to exercise picks, queues, and trades
  // even when the real league draft room is closed.
  const qa = await getActiveQaSession();
  if (qa?.mode === 'rehearsal') return true;

  const league = await getCurrentLeague();
  if (!league) return false;
  const lifecycle = (league.config.draftLifecycle || {}) as { state?: unknown };
  return lifecycle.state === 'open';
}
