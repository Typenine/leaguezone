import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { signSession } from '@/lib/server/auth';

// ── Password hashing ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── User record ───────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string | null;
  role: string;
  emailVerified: boolean;
  emailVerificationRequired: boolean;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, email, display_name, password_hash, role, email_verified, email_verification_required
      FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (!rows[0]) return null;
    return rowToUser(rows[0]);
  } catch {
    return null;
  }
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, email, display_name, password_hash, role, email_verified, email_verification_required
      FROM users WHERE id = ${id}::uuid LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (!rows[0]) return null;
    return rowToUser(rows[0]);
  } catch {
    return null;
  }
}

function rowToUser(r: Record<string, unknown>): UserRecord {
  return {
    id: r.id as string,
    email: r.email as string,
    displayName: (r.display_name as string | null) ?? null,
    passwordHash: (r.password_hash as string | null) ?? null,
    role: (r.role as string) || 'user',
    emailVerified: Boolean(r.email_verified),
    emailVerificationRequired: Boolean(r.email_verification_required),
  };
}

export async function createUser(
  email: string,
  displayName: string,
  password: string,
): Promise<UserRecord> {
  const db = getDb();
  const hash = await hashPassword(password);
  const res = await db.execute(sql`
    INSERT INTO users (
      email,
      display_name,
      password_hash,
      role,
      email_verified,
      email_verification_required
    )
    VALUES (${email.toLowerCase()}, ${displayName.trim()}, ${hash}, 'user', false, true)
    RETURNING id, email, display_name, password_hash, role, email_verified, email_verification_required
  `);
  const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  if (!rows[0]) throw new Error('User creation failed');
  return rowToUser(rows[0]);
}

// ── Session signing ───────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'evw_session';
export const SESSION_TTL_DAYS = 30;

export function signUserSession(userId: string): string {
  return signSession({
    sub: userId,
    type: 'user',
    exp: Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function sessionCookieOptions(maxAgeSecs?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSecs ?? SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

// ── Token generation ──────────────────────────────────────────────────────────

export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

// ── League membership ─────────────────────────────────────────────────────────

export interface UserLeague {
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  teamName: string;
  rosterId: number | null;
  isCommissioner: boolean;
}

export async function getUserLeagues(userId: string): Promise<UserLeague[]> {
  try {
    const db = getDb();
    // Primary: leagues the user has claimed an invite for
    const claimedRes = await db.execute(sql`
      SELECT
        li.league_id::text AS league_id,
        l.slug             AS league_slug,
        l.name             AS league_name,
        li.team_name,
        li.roster_id,
        true               AS is_commissioner_check,
        (l.commissioner_user_id = ${userId}::uuid) AS is_commissioner
      FROM league_invites li
      JOIN leagues l ON l.id = li.league_id AND l.setup_completed = true
      WHERE li.claimed_by = ${userId}::uuid
      ORDER BY l.created_at DESC
    `);
    const claimedRows = (claimedRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    const claimedLeagueIds = new Set(claimedRows.map((r) => r.league_id as string));

    // Commissioner-only: leagues the user created but hasn't claimed a team invite for yet
    const ownedRes = await db.execute(sql`
      SELECT
        l.id::text         AS league_id,
        l.slug             AS league_slug,
        l.name             AS league_name,
        'Commissioner'     AS team_name,
        NULL::int          AS roster_id,
        true               AS is_commissioner
      FROM leagues l
      WHERE l.commissioner_user_id = ${userId}::uuid
        AND l.setup_completed = true
      ORDER BY l.created_at DESC
    `);
    const ownedRows = (ownedRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];

    const combined = [
      ...claimedRows,
      // Only add owned rows for leagues not already in the claimed list
      ...ownedRows.filter((r) => !claimedLeagueIds.has(r.league_id as string)),
    ];

    return combined.map((r) => ({
      leagueId: r.league_id as string,
      leagueSlug: r.league_slug as string,
      leagueName: r.league_name as string,
      teamName: r.team_name as string,
      rosterId: (r.roster_id as number | null) ?? null,
      isCommissioner: Boolean(r.is_commissioner),
    }));
  } catch {
    return [];
  }
}

// ── Validation helpers ────────────────────────────────────────────────────────

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  if (!trimmed.includes('@') || !trimmed.includes('.')) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Display name is required';
  if (trimmed.length < 2) return 'Display name must be at least 2 characters';
  if (trimmed.length > 50) return 'Display name must be 50 characters or fewer';
  return null;
}
