import { randomBytes } from 'node:crypto';
import { signSession, verifySession } from '@/lib/server/auth';

const YAHOO_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type YahooOAuthState = {
  userId: string;
  leagueId: string;
};

export function createYahooOAuthState(userId: string, leagueId: string): string {
  return signSession({
    type: 'yahoo_oauth',
    sub: userId,
    leagueId,
    nonce: randomBytes(16).toString('base64url'),
    exp: Date.now() + YAHOO_OAUTH_STATE_TTL_MS,
  });
}

export function verifyYahooOAuthState(value: string): YahooOAuthState | null {
  if (!value) return null;
  const payload = verifySession(value);
  if (!payload || payload.type !== 'yahoo_oauth') return null;

  const userId = typeof payload.sub === 'string' ? payload.sub : '';
  const leagueId = typeof payload.leagueId === 'string' ? payload.leagueId : '';
  if (!userId || !leagueId) return null;

  return { userId, leagueId };
}
