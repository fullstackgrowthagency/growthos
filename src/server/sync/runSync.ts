import { prisma } from "@/server/db/prisma";
import { Prisma, type SyncEntity } from "@prisma/client";
import { syncContactsPage } from "@/server/sync/syncContacts";
import { syncOpportunitiesPage } from "@/server/sync/syncOpportunities";
import { syncAppointmentsPage } from "@/server/sync/syncAppointments";
import { syncPaymentsPage } from "@/server/sync/syncPayments";

const TIME_BUDGET_MS = 50_000;

const ENTITY_ORDER: SyncEntity[] = ["CONTACTS", "OPPORTUNITIES", "APPOINTMENTS", "PAYMENTS"];

type SyncCursor = Record<string, unknown> | null;

function cursorToJsonInput(cursor: SyncCursor) {
  return cursor === null ? Prisma.JsonNull : (cursor as Prisma.InputJsonValue);
}

/**
 * Runs due sync work for one agency within a bounded time budget, then
 * returns. Designed to be invoked repeatedly (cron tick, manual trigger)
 * rather than run to full completion in one call — each invocation
 * resumes from the cursor persisted on the relevant SyncRun row.
 *
 * Contacts are synced before opportunities/appointments/payments for each
 * location so the latter can resolve `contactId` foreign keys.
 */
export async function runSyncForAgency(agencyId: string): Promise<void> {
  const deadline = Date.now() + TIME_BUDGET_MS;

  const locations = await prisma.location.findMany({
    where: { agencyId, status: "ACTIVE" },
  });

  for (const location of locations) {
    for (const entity of ENTITY_ORDER) {
      if (Date.now() > deadline) return;
      await processEntitySync(agencyId, location.id, location.ghlLocationId, entity, deadline);
    }

    const stillPending = await prisma.syncRun.findFirst({
      where: { locationId: location.id, status: { in: ["PENDING", "RUNNING", "PARTIAL"] } },
    });
    if (!stillPending) {
      await prisma.location.update({ where: { id: location.id }, data: { lastSyncedAt: new Date() } });
    }
  }
}

async function processEntitySync(
  agencyId: string,
  locationId: string,
  ghlLocationId: string,
  entity: SyncEntity,
  deadline: number,
): Promise<void> {
  let run = await prisma.syncRun.findFirst({
    where: { locationId, entity, status: { in: ["PENDING", "RUNNING", "PARTIAL"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!run) {
    // Nothing due for this entity right now.
    return;
  }

  run = await prisma.syncRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", startedAt: run.startedAt ?? new Date() },
  });

  let cursor = run.cursor as SyncCursor;
  let totalSynced = run.recordsSynced;

  try {
    while (Date.now() < deadline) {
      const result = await syncOnePage(agencyId, locationId, ghlLocationId, entity, cursor);
      totalSynced += result.recordsSynced;

      if (!result.nextCursor) {
        await prisma.syncRun.update({
          where: { id: run.id },
          data: { status: "SUCCEEDED", cursor: Prisma.JsonNull, recordsSynced: totalSynced, finishedAt: new Date() },
        });
        return;
      }

      cursor = result.nextCursor as SyncCursor;
      await prisma.syncRun.update({
        where: { id: run.id },
        data: { cursor: cursorToJsonInput(cursor), recordsSynced: totalSynced },
      });
    }

    // Ran out of time budget mid-entity — leave PARTIAL so the next tick resumes.
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "PARTIAL", cursor: cursorToJsonInput(cursor), recordsSynced: totalSynced },
    });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    });
  }
}

async function syncOnePage(
  agencyId: string,
  locationId: string,
  ghlLocationId: string,
  entity: SyncEntity,
  cursor: SyncCursor,
) {
  switch (entity) {
    case "CONTACTS":
      return syncContactsPage(agencyId, locationId, ghlLocationId, cursor);
    case "OPPORTUNITIES":
      return syncOpportunitiesPage(agencyId, locationId, ghlLocationId, cursor);
    case "APPOINTMENTS":
      return syncAppointmentsPage(agencyId, locationId, ghlLocationId, cursor);
    case "PAYMENTS":
      return syncPaymentsPage(agencyId, locationId, ghlLocationId, cursor);
    case "LOCATIONS":
      return { nextCursor: null, recordsSynced: 0 };
  }
}

/** Seeds PENDING SyncRuns for a freshly installed or newly discovered location. */
export async function seedSyncRunsForLocation(agencyId: string, locationId: string): Promise<void> {
  await prisma.syncRun.createMany({
    data: ENTITY_ORDER.map((entity) => ({ agencyId, locationId, entity, status: "PENDING" as const })),
  });
}

/** Runs due sync work across every active agency — the cron entrypoint. */
export async function runSyncForAllAgencies(): Promise<void> {
  const agencies = await prisma.agency.findMany({
    where: { installation: { status: "ACTIVE" } },
    select: { id: true },
  });
  for (const agency of agencies) {
    await runSyncForAgency(agency.id);
  }
}
