import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/authOptions";
import { prisma } from "@/server/db/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agencyId = session.user.agencyId;

  const [pending, running, partial, failed, mostRecentFinish] = await Promise.all([
    prisma.syncRun.count({ where: { agencyId, status: "PENDING" } }),
    prisma.syncRun.count({ where: { agencyId, status: "RUNNING" } }),
    prisma.syncRun.count({ where: { agencyId, status: "PARTIAL" } }),
    prisma.syncRun.count({ where: { agencyId, status: "FAILED" } }),
    prisma.syncRun.findFirst({
      where: { agencyId, status: "SUCCEEDED" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);

  const inProgress = pending + running + partial > 0;

  return NextResponse.json({
    inProgress,
    pending,
    running,
    partial,
    failed,
    lastSyncedAt: mostRecentFinish?.finishedAt ?? null,
  });
}
