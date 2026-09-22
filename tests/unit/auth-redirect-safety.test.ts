import { describe, expect, it } from 'vitest';
import { getLoginHref, getSafePostLoginPath } from '@/lib/navigation/auth-redirect';

describe('post-login redirect safety', () => {
  it('sends authentication-flow destinations to the signed-in dashboard', () => {
    expect(getSafePostLoginPath('/register')).toBe('/app');
    expect(getSafePostLoginPath('/register?invite=abc')).toBe('/app');
    expect(getSafePostLoginPath('/login')).toBe('/app');
    expect(getSafePostLoginPath('/verify-email')).toBe('/app');
    expect(getSafePostLoginPath('/verify-email/token-123')).toBe('/app');
    expect(getSafePostLoginPath('/forgot-password')).toBe('/app');
    expect(getSafePostLoginPath('/reset-password/token-123')).toBe('/app');
  });

  it('preserves valid internal deep links', () => {
    expect(getSafePostLoginPath('/pricing')).toBe('/pricing');
    expect(getSafePostLoginPath('/l/test-league/standings?season=2026')).toBe(
      '/l/test-league/standings?season=2026',
    );
  });

  it('rejects external and protocol-relative destinations', () => {
    expect(getSafePostLoginPath('https://example.com')).toBe('/app');
    expect(getSafePostLoginPath('//example.com')).toBe('/app');
    expect(getSafePostLoginPath('')).toBe('/app');
  });

  it('does not make register send users back to register after sign in', () => {
    expect(getLoginHref('/register')).toBe('/login');
    expect(getLoginHref('/pricing')).toBe('/login?next=%2Fpricing');
  });
});
