const AUTH_FLOW_PATHS = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
] as const;

function isAuthFlowPath(pathname: string): boolean {
  return AUTH_FLOW_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getSafePostLoginPath(
  requested: string | null | undefined,
  fallback = '/app',
): string {
  const candidate = requested?.trim() || '';
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;

  try {
    const pathname = new URL(candidate, 'https://leaguezone.local').pathname;
    if (isAuthFlowPath(pathname)) return fallback;
    return candidate;
  } catch {
    return fallback;
  }
}

export function getLoginHref(pathname: string): string {
  const next = getSafePostLoginPath(pathname);
  return next === '/app' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}
