import { getCurrentLeague } from '@/lib/server/league-context';

export async function isDraftLifecycleOpen(): Promise<boolean> {
  const league = await getCurrentLeague();
  if (!league) return false;
  const lifecycle = (league.config.draftLifecycle || {}) as { state?: unknown };
  return lifecycle.state === 'open';
}
