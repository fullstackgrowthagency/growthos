const SYNC_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Next.js runs this once when a server instance boots, before it serves
 * any requests. Hostinger's Node.js Web Apps Hosting (the deploy target
 * for this app) has no cron/scheduled-jobs product, but it does run a
 * genuine persistent Node process — so instead of an external scheduler,
 * the process schedules its own sync work by self-calling the existing
 * /api/cron/sync route over loopback.
 *
 * Deliberately a plain `fetch` self-call rather than importing the sync
 * orchestrator directly: this file is also compiled for the edge
 * runtime, and the orchestrator's dependency graph (Prisma, node:crypto
 * via the token cipher) isn't edge-compatible — importing it here breaks
 * the edge build even though the code only ever runs in the Node runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const port = process.env.PORT ?? "3000";
  const url = `http://127.0.0.1:${port}/api/cron/sync`;
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // eslint-disable-next-line no-console
    console.warn("CRON_SECRET not set — in-process sync scheduler will not start.");
    return;
  }

  setInterval(() => {
    fetch(url, { headers: { Authorization: `Bearer ${secret}` } }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Scheduled sync self-call failed", err);
    });
  }, SYNC_INTERVAL_MS);
}
