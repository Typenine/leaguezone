import { getKV } from '@/lib/server/kv';

export type ReliabilityCacheResult<T> = {
  value: T;
  stale: boolean;
  cachedAt: number | null;
  source: 'live' | 'cache';
};

type Envelope<T> = {
  value: T;
  cachedAt: number;
};

const PREFIX = 'lz:reliability:v1';

function normalizePart(value: string | number | null | undefined): string {
  return String(value ?? 'none').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '_').slice(0, 180);
}

export function reliabilityKey(...parts: Array<string | number | null | undefined>): string {
  return [PREFIX, ...parts.map(normalizePart)].join(':');
}

function parseEnvelope<T>(raw: unknown): Envelope<T> | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { value?: unknown; cachedAt?: unknown };
  if (typeof candidate.cachedAt !== 'number' || !Number.isFinite(candidate.cachedAt)) return null;
  if (!('value' in candidate)) return null;
  return { value: candidate.value as T, cachedAt: candidate.cachedAt };
}

export async function readReliabilityCache<T>(
  key: string,
  maxAgeSeconds: number,
): Promise<ReliabilityCacheResult<T> | null> {
  const kv = await getKV();
  if (!kv) return null;
  try {
    const envelope = parseEnvelope<T>(await kv.get(key));
    if (!envelope) return null;
    const ageMs = Date.now() - envelope.cachedAt;
    if (ageMs < 0 || ageMs > maxAgeSeconds * 1000) return null;
    return {
      value: envelope.value,
      stale: true,
      cachedAt: envelope.cachedAt,
      source: 'cache',
    };
  } catch {
    return null;
  }
}

export async function writeReliabilityCache<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.set(key, { value, cachedAt: Date.now() } satisfies Envelope<T>);
    await kv.expire?.(key, Math.max(60, ttlSeconds));
  } catch {
    // Reliability cache is best-effort. The primary request must not fail because KV is unavailable.
  }
}

export async function readThroughReliabilityCache<T>(input: {
  key: string;
  freshForSeconds: number;
  staleForSeconds: number;
  load: () => Promise<T>;
  cacheNull?: boolean;
}): Promise<ReliabilityCacheResult<T>> {
  const fresh = await readReliabilityCache<T>(input.key, input.freshForSeconds);
  if (fresh) {
    return { ...fresh, stale: false };
  }

  try {
    const value = await input.load();
    if (value !== null || input.cacheNull) {
      await writeReliabilityCache(input.key, value, input.staleForSeconds);
    }
    return { value, stale: false, cachedAt: Date.now(), source: 'live' };
  } catch (error) {
    const fallback = await readReliabilityCache<T>(input.key, input.staleForSeconds);
    if (fallback) return fallback;
    throw error;
  }
}

export function reliabilityResponseHeaders(result: Pick<ReliabilityCacheResult<unknown>, 'stale' | 'cachedAt'>): HeadersInit {
  if (!result.stale) return { 'X-LeagueZone-Data-Mode': 'live' };
  return {
    'X-LeagueZone-Data-Mode': 'stale',
    ...(result.cachedAt ? { 'X-LeagueZone-Cached-At': new Date(result.cachedAt).toISOString() } : {}),
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=300',
  };
}
