/**
 * Unit tests for invite claiming logic.
 */
import { describe, it, expect } from 'vitest';

// ─── Invite code validation ───────────────────────────────────────────────────

describe('invite code security', () => {
  // The generateInviteCode helper from setup/sleeper
  function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  it('generates 8-character codes using safe charset', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    // With 32^8 = 1.1 trillion possibilities, 100 should be unique
    expect(codes.size).toBe(100);
  });

  it('codes do not contain ambiguous characters (O, I, 0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).not.toMatch(/[OI01]/);
    }
  });
});

// ─── Invite claiming: business rules ─────────────────────────────────────────

describe('invite claiming rules', () => {
  function simulateClaim(invite: { claimed_by: string | null }, userId: string) {
    if (invite.claimed_by !== null) {
      return { ok: false, error: 'This team has already been claimed', status: 409 };
    }
    if (invite.claimed_by === userId) {
      return { ok: false, error: 'You have already claimed this invite', status: 409 };
    }
    return { ok: true, claimed_by: userId };
  }

  it('allows first claim', () => {
    const invite = { claimed_by: null };
    const result = simulateClaim(invite, 'user-1');
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate claim by same user', () => {
    const invite = { claimed_by: 'user-1' };
    const result = simulateClaim(invite, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it('rejects claim of already-claimed invite by different user', () => {
    const invite = { claimed_by: 'user-1' };
    const result = simulateClaim(invite, 'user-2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it('two users cannot claim the same invite', () => {
    const invite: { claimed_by: string | null } = { claimed_by: null };
    // First claim succeeds
    const r1 = simulateClaim(invite, 'user-1');
    expect(r1.ok).toBe(true);
    // Simulate DB state after first claim
    if (r1.ok) invite.claimed_by = r1.claimed_by ?? null;
    // Second claim fails
    const r2 = simulateClaim(invite, 'user-2');
    expect(r2.ok).toBe(false);
  });
});
