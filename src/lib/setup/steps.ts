export const SETUP_STEP_IDS = [
  'league',
  'provider',
  'branding',
  'teams',
  'rules',
  'auth',
] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

const SETUP_STEP_SET = new Set<string>(SETUP_STEP_IDS);

export function normalizeCompletedSetupSteps(value: unknown): SetupStepId[] {
  if (!Array.isArray(value)) return [];

  const normalized: SetupStepId[] = [];
  const seen = new Set<SetupStepId>();

  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const candidate = raw === 'sleeper' ? 'provider' : raw;

    // "admin" was a legacy setup step that incorrectly mixed league
    // commissioner setup with platform-admin account creation. It is
    // intentionally ignored now.
    if (!SETUP_STEP_SET.has(candidate)) continue;

    const step = candidate as SetupStepId;
    if (!seen.has(step)) {
      seen.add(step);
      normalized.push(step);
    }
  }

  return normalized;
}
