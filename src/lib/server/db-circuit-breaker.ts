export class DatabaseCircuitOpenError extends Error {
  readonly code = 'DATABASE_CIRCUIT_OPEN';

  constructor(public readonly retryAt: number) {
    super('Database access is temporarily paused after repeated infrastructure failures.');
    this.name = 'DatabaseCircuitOpenError';
  }
}

type FailureRecord = { at: number };

const FAILURE_WINDOW_MS = 30_000;
const OPEN_MS = 60_000;
const FAILURE_THRESHOLD = 3;

let failures: FailureRecord[] = [];
let openUntil = 0;

function prune(now: number) {
  failures = failures.filter((item) => now - item.at <= FAILURE_WINDOW_MS);
}

export function beforeDatabaseRequest(now = Date.now()): void {
  if (openUntil > now) throw new DatabaseCircuitOpenError(openUntil);
  if (openUntil && openUntil <= now) {
    openUntil = 0;
    failures = [];
  }
}

export function recordDatabaseSuccess(): void {
  failures = [];
  openUntil = 0;
}

export function recordDatabaseFailure(now = Date.now()): { opened: boolean; openUntil: number } {
  prune(now);
  failures.push({ at: now });
  if (failures.length >= FAILURE_THRESHOLD) {
    openUntil = Math.max(openUntil, now + OPEN_MS);
    return { opened: true, openUntil };
  }
  return { opened: false, openUntil };
}

export function getDatabaseCircuitState(now = Date.now()): {
  open: boolean;
  openUntil: number | null;
  recentFailures: number;
} {
  prune(now);
  return {
    open: openUntil > now,
    openUntil: openUntil > now ? openUntil : null,
    recentFailures: failures.length,
  };
}

export function resetDatabaseCircuitForTests(): void {
  failures = [];
  openUntil = 0;
}
