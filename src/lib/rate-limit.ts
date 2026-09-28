/**
 * Small in-memory sliding-window rate limiter.
 * Good enough for a single-instance MVP; the interface allows swapping in a
 * Redis-backed limiter later without touching call sites.
 */

type Bucket = { hits: number[] };

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  if (now - lastSweep > 5 * 60_000) {
    for (const [k, bucket] of store) {
      bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
      if (bucket.hits.length === 0) store.delete(k);
    }
    lastSweep = now;
  }

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export function clientIp(headersStore: Headers): string {
  return (
    headersStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersStore.get("x-real-ip") ||
    "local"
  );
}
