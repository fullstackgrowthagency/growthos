import { prisma } from "@/server/db/prisma";
import { GhlApiError } from "@/server/ghl/client";

const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 90; // stay under GHL's ~100/10s ceiling

/**
 * Postgres-backed sliding-window limiter, keyed per agency. Counts recent
 * calls (via SyncRun-independent rows in RateLimitTick) and, if the
 * window is nearly full, waits out the remainder of the window rather
 * than firing the request and risking a 429.
 *
 * Kept intentionally simple (no Redis) since phase 1 syncs run from
 * serverless functions with short lifetimes — a DB round trip per call
 * is cheap relative to the GHL API call itself.
 */
export async function throttle(agencyId: string): Promise<void> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const recentCount = await prisma.rateLimitTick.count({
    where: { agencyId, occurredAt: { gte: windowStart } },
  });

  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = await prisma.rateLimitTick.findFirst({
      where: { agencyId, occurredAt: { gte: windowStart } },
      orderBy: { occurredAt: "asc" },
    });
    const waitMs = oldestInWindow
      ? Math.max(0, oldestInWindow.occurredAt.getTime() + WINDOW_MS - Date.now())
      : WINDOW_MS;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  await prisma.rateLimitTick.create({ data: { agencyId } });

  // Opportunistic cleanup so the table doesn't grow unbounded.
  await prisma.rateLimitTick.deleteMany({
    where: { agencyId, occurredAt: { lt: windowStart } },
  });
}

/**
 * Wraps a GHL API call with rate-limit throttling and Retry-After-aware
 * backoff on 429s. Bounded to 3 attempts — a persistent 429 beyond that
 * is left for the next sync tick to pick up rather than blocking the
 * current serverless invocation indefinitely.
 */
export async function withRateLimit<T>(agencyId: string, fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    await throttle(agencyId);
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (err instanceof GhlApiError && err.status === 429 && attempt < 3) {
        const backoffMs = err.retryAfterSeconds ? err.retryAfterSeconds * 1000 : 2 ** attempt * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
}
