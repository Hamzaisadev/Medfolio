import type { IncomingMessage } from 'node:http';

/**
 * In-memory fixed-window rate limiter.
 *
 * Scope caveat: serverless instances do not share this map, so the effective
 * limit is per-instance. It is a cheap abuse brake, not a quota.
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const MAX_TRACKED_KEYS = 10_000;

function evictExpired(now: number): void {
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequestsPerMinute: number = 20
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // Bound memory growth: sweep expired entries before admitting a new key.
    if (rateLimitMap.size >= MAX_TRACKED_KEYS) {
      evictExpired(now);
    }
    rateLimitMap.set(key, { count: 1, resetTime: now + 60_000 });
    return { allowed: true, remaining: maxRequestsPerMinute - 1 };
  }

  if (entry.count >= maxRequestsPerMinute) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequestsPerMinute - entry.count };
}

/**
 * Returns the client IP for rate-limiting purposes.
 *
 * `x-forwarded-for` is a chain ("client, proxy1, proxy2"); the left-most entry is
 * the original client. Only trusted when the platform sets it (Vercel does).
 */
export function clientIpOf(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || '127.0.0.1';
}
