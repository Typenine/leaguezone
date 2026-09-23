import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import {
  beforeDatabaseRequest,
  recordDatabaseFailure,
  recordDatabaseSuccess,
  getDatabaseCircuitState,
  DatabaseCircuitOpenError,
} from '@/lib/server/db-circuit-breaker';

let _db: ReturnType<typeof drizzle> | null = null;

export { DatabaseCircuitOpenError };

export function isDatabaseCircuitOpen(): boolean {
  return getDatabaseCircuitState().open;
}

export function getDatabaseReliabilityState() {
  return getDatabaseCircuitState();
}

function isInfrastructureFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const status = Number(record.status ?? record.statusCode ?? record.httpStatus);
  if ([402, 408, 425, 429].includes(status) || status >= 500) return true;

  const code = String(record.code || '').toUpperCase();
  if (code.startsWith('08') || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'].includes(code)) {
    return true;
  }

  const message = String(record.message || error).toLowerCase();
  return [
    'exceeded the quota',
    'fetch failed',
    'network error',
    'connection refused',
    'connection reset',
    'connection terminated',
    'timed out',
    'timeout',
    'service unavailable',
    'temporarily unavailable',
    'neon:retryable',
  ].some((needle) => message.includes(needle));
}

function handleDatabaseFailure(error: unknown): void {
  if (!isInfrastructureFailure(error)) return;
  const state = recordDatabaseFailure();
  if (state.opened) {
    console.error('[db-circuit] opened after repeated infrastructure failures', {
      retryAt: new Date(state.openUntil).toISOString(),
    });
  }
}

function guardedNeonClient(url: string) {
  const raw = neon(url);
  return new Proxy(raw, {
    apply(target, thisArg, argArray) {
      beforeDatabaseRequest();
      let result: unknown;
      try {
        result = Reflect.apply(target, thisArg, argArray);
      } catch (error) {
        handleDatabaseFailure(error);
        throw error;
      }

      return Promise.resolve(result).then(
        (value) => {
          recordDatabaseSuccess();
          return value;
        },
        (error) => {
          handleDatabaseFailure(error);
          throw error;
        },
      );
    },
  }) as typeof raw;
}

export function getDb() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    throw new Error('DATABASE_URL (or POSTGRES_URL/POSTGRES_PRISMA_URL) is missing. Add it in your environment to enable Postgres.');
  }
  if (_db) return _db;
  _db = drizzle(guardedNeonClient(url));
  return _db;
}
