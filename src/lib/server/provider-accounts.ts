import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { decryptProviderToken, encryptProviderToken } from '@/lib/providers/crypto';
import { refreshYahooAccessToken, type YahooTokenResponse } from '@/lib/providers/yahoo';

const YAHOO_PROVIDER = 'yahoo';
const REFRESH_EARLY_MS = 5 * 60 * 1000;

type ProviderAccountRow = {
  provider_user_id?: string | null;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  token_expires_at?: Date | string | null;
};

export type YahooConnectionStatus = {
  connected: boolean;
  providerUserId: string | null;
};

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
}

export async function saveYahooProviderAccount(
  userId: string,
  token: YahooTokenResponse,
  existingRefreshToken?: string | null,
): Promise<void> {
  const accessTokenEncrypted = encryptProviderToken(token.access_token);
  const refreshToken = token.refresh_token || existingRefreshToken || '';
  if (!refreshToken) {
    throw new Error('Yahoo did not return a refresh token. Reauthorization is required.');
  }
  const refreshTokenEncrypted = encryptProviderToken(refreshToken);
  const expiresAt = new Date(Date.now() + Math.max(60, token.expires_in) * 1000);
  const providerUserId = token.xoauth_yahoo_guid?.trim() || null;
  const db = getDb();

  await db.execute(sql`
    INSERT INTO provider_accounts (
      user_id,
      provider,
      provider_user_id,
      access_token_encrypted,
      refresh_token_encrypted,
      token_expires_at,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      ${userId}::uuid,
      ${YAHOO_PROVIDER},
      ${providerUserId},
      ${accessTokenEncrypted},
      ${refreshTokenEncrypted},
      ${expiresAt},
      '{}'::jsonb,
      now(),
      now()
    )
    ON CONFLICT (user_id, provider) DO UPDATE SET
      provider_user_id = COALESCE(EXCLUDED.provider_user_id, provider_accounts.provider_user_id),
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      token_expires_at = EXCLUDED.token_expires_at,
      updated_at = now()
  `);
}

export async function getYahooConnectionStatus(userId: string): Promise<YahooConnectionStatus> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT provider_user_id
    FROM provider_accounts
    WHERE user_id = ${userId}::uuid
      AND provider = ${YAHOO_PROVIDER}
    LIMIT 1
  `);
  const row = rowsOf(result)[0];
  return {
    connected: Boolean(row),
    providerUserId: typeof row?.provider_user_id === 'string' ? row.provider_user_id : null,
  };
}

export async function disconnectYahooProviderAccount(userId: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    DELETE FROM provider_accounts
    WHERE user_id = ${userId}::uuid
      AND provider = ${YAHOO_PROVIDER}
  `);
}

async function getYahooProviderAccount(userId: string): Promise<ProviderAccountRow | null> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT provider_user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at
    FROM provider_accounts
    WHERE user_id = ${userId}::uuid
      AND provider = ${YAHOO_PROVIDER}
    LIMIT 1
  `);
  const row = rowsOf(result)[0];
  return row ? (row as ProviderAccountRow) : null;
}

export async function getFreshYahooAccessToken(userId: string): Promise<string> {
  const account = await getYahooProviderAccount(userId);
  if (!account?.access_token_encrypted || !account.refresh_token_encrypted) {
    throw new Error('Yahoo account is not connected.');
  }

  const accessToken = decryptProviderToken(account.access_token_encrypted);
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_EARLY_MS) {
    return accessToken;
  }

  const currentRefreshToken = decryptProviderToken(account.refresh_token_encrypted);
  const refreshed = await refreshYahooAccessToken(currentRefreshToken);
  await saveYahooProviderAccount(userId, refreshed, currentRefreshToken);
  return refreshed.access_token;
}

export async function getFreshYahooAccessTokenForLeague(leagueId: string): Promise<string> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT commissioner_user_id
    FROM leagues
    WHERE id = ${leagueId}::uuid
      AND setup_completed = true
      AND is_active = true
    LIMIT 1
  `);
  const commissionerUserId = rowsOf(result)[0]?.commissioner_user_id;
  if (typeof commissionerUserId !== 'string' || !commissionerUserId) {
    throw new Error('Yahoo league does not have a connected LeagueZone commissioner.');
  }
  return getFreshYahooAccessToken(commissionerUserId);
}
