export function getConfiguredAdminSecret(): string | null {
  return process.env.EVW_ADMIN_SECRET?.trim() || '002023';
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
