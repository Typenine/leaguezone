/**
 * Legacy per-league "commissioner" secret cookie value.
 *
 * IMPORTANT: this must never fall back to a hardcoded default. This repo is
 * a public template, so any hardcoded value here is a known credential to
 * every deployment that forgets to set EVW_ADMIN_SECRET. If the env var is
 * not configured, legacy admin login is disabled (fails closed) rather than
 * silently granting commissioner-equivalent access to anyone.
 */
export function getConfiguredAdminSecret(): string | null {
  const secret = process.env.EVW_ADMIN_SECRET?.trim();
  return secret ? secret : null;
}

export function isAdminCookieValue(value: string | null | undefined): boolean {
  const secret = getConfiguredAdminSecret();
  return Boolean(secret && value === secret);
}

/** Super-admin (site-wide) helpers ---------------------------------------- */

export function getSuperAdminSecret(): string | null {
  return process.env.SUPER_ADMIN_KEY?.trim() || null;
}

export function isSiteAdminCookieValue(value: string | null | undefined): boolean {
  const secret = getSuperAdminSecret();
  return Boolean(secret && value === secret);
}
