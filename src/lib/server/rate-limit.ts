import { getKV } from './kv';

export interface RateLimitConfig {
  // Maximum number of requests allowed
  maxRequests: number;
  // Time window in seconds
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  backendAvailable?: boolean;
}

/**
 * Rate limit by IP address and action type
 * Uses sliding window with KV store
 */
export async function rateLimitByIp(
  ip: string,
  action: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const kv = await getKV();
  if (!kv) {
    // If KV is not available, allow the request
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowSeconds * 1000 };
  }

  const key = `rate_limit:${action}:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get current count
    const count = await kv.incr(key);
    
    // Set expiration on first request
    if (count === 1) {
      await kv.expire?.(key, config.windowSeconds);
    }

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = (now + (await kv.ttl?.(key) || config.windowSeconds)) * 1000;

    return { allowed, remaining, resetAt };
  } catch {
    // If rate limiting fails, allow the request
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowSeconds * 1000 };
  }
}

// Default rate limits for auth endpoints
export const AUTH_RATE_LIMITS = {
  // 5 registration attempts per hour per IP
  register: { maxRequests: 5, windowSeconds: 60 * 60 },
  // 10 login attempts per 5 minutes per IP
  login: { maxRequests: 10, windowSeconds: 5 * 60 },
  // 3 password reset requests per hour per email
  passwordReset: { maxRequests: 3, windowSeconds: 60 * 60 },
  // 5 verification email resends per hour per IP
  resendVerification: { maxRequests: 5, windowSeconds: 60 * 60 },
} as const;


const strictFallbackBuckets = new Map<string, { count: number; resetAt: number }>();

function strictLocalFallback(
  ip: string,
  action: string,
  config: RateLimitConfig,
): RateLimitResult {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const existing = strictFallbackBuckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + config.windowSeconds * 1000 }
    : existing;
  bucket.count += 1;
  strictFallbackBuckets.set(key, bucket);

  if (strictFallbackBuckets.size > 2_000) {
    for (const [entryKey, entry] of strictFallbackBuckets) {
      if (entry.resetAt <= now) strictFallbackBuckets.delete(entryKey);
    }
  }

  return {
    allowed: bucket.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - bucket.count),
    resetAt: bucket.resetAt,
    backendAvailable: false,
  };
}

export async function rateLimitByIpStrict(
  ip: string,
  action: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (process.env.E2E_TEST_MODE === 'true' || process.env.E2E_TEST_MODE === '1') {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: Date.now() + config.windowSeconds * 1000,
      backendAvailable: true,
    };
  }

  const kv = await getKV();
  if (!kv) return strictLocalFallback(ip, action, config);

  const key = `strict_rate_limit:${action}:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire?.(key, config.windowSeconds);
    const ttl = await kv.ttl?.(key);
    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt: (now + (ttl && ttl > 0 ? ttl : config.windowSeconds)) * 1000,
      backendAvailable: true,
    };
  } catch {
    return strictLocalFallback(ip, action, config);
  }
}
