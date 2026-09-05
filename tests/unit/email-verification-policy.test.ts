import { describe, expect, it } from 'vitest';
import { requiresEmailVerification } from '@/lib/server/user-auth';

describe('email verification login policy', () => {
  it('grandfathers existing accounts even when their legacy email_verified flag is false', () => {
    expect(requiresEmailVerification({
      emailVerified: false,
      emailVerificationRequired: false,
    })).toBe(false);
  });

  it('blocks newly created accounts until their email is verified', () => {
    expect(requiresEmailVerification({
      emailVerified: false,
      emailVerificationRequired: true,
    })).toBe(true);
  });

  it('allows newly created accounts after verification succeeds', () => {
    expect(requiresEmailVerification({
      emailVerified: true,
      emailVerificationRequired: true,
    })).toBe(false);
  });
});
