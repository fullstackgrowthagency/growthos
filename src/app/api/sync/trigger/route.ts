import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/authOptions";
import { prisma } from "@/server/db/prisma";
import { runSyncForAgency } from "@/server/sync/runSync";

/**
 * "Refresh Now" — re-queues any completed SyncRuns as PENDING and kicks
 * off a bounded sync pass inline. The route itself awaits one pass (up to
 * the orchestrator's internal time budget); the UI polls /api/sync/status
 * afterward in case more passes are needed to fully catch up.
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agencyId = session.user.agencyId;

  await prisma.syncRun.updateMany({
    where: { agencyId, status: "SUCCEEDED" },
    data: { status: "PENDING" },
  });

  await runSyncForAgency(agencyId);

  return NextResponse.json({ ok: true });
}
