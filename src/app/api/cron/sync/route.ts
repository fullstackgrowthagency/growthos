import { NextRequest, NextResponse } from "next/server";
import { runSyncForAllAgencies } from "@/server/sync/runSync";

export const maxDuration = 60;

/**
 * Vercel Cron entrypoint (see vercel.json — every 15 minutes). Protected
 * by a shared secret rather than session auth since Vercel Cron requests
 * carry no user session.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await runSyncForAllAgencies();

  return NextResponse.json({ ok: true });
}
