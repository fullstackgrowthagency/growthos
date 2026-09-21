import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { verifyGhlWebhookSignature } from "@/lib/webhookVerify";
import { seedSyncRunsForLocation } from "@/server/sync/runSync";

interface GhlWebhookPayload {
  webhookId?: string;
  type: string;
  companyId?: string;
  locationId?: string;
  locationName?: string;
  timezone?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("X-GHL-Signature");

  if (!verifyGhlWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as GhlWebhookPayload;
  const webhookId = payload.webhookId ?? `${payload.type}:${payload.locationId ?? payload.companyId}:${Date.now()}`;

  const existing = await prisma.webhookEvent.findUnique({ where: { ghlWebhookId: webhookId } });
  if (existing) {
    // Already processed (or in flight) — GHL retried a delivery.
    return NextResponse.json({ ok: true, deduped: true });
  }

  const event = await prisma.webhookEvent.create({
    data: { ghlWebhookId: webhookId, type: payload.type, payload: payload as never },
  });

  try {
    await routeEvent(payload);
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "failed", processedAt: new Date() },
    });
    // eslint-disable-next-line no-console
    console.error("Failed to process GHL webhook", event.id, err);
  }

  return NextResponse.json({ ok: true });
}

async function routeEvent(payload: GhlWebhookPayload): Promise<void> {
  switch (payload.type) {
    case "AppUninstall": {
      if (!payload.companyId) return;
      const agency = await prisma.agency.findUnique({ where: { ghlCompanyId: payload.companyId } });
      if (!agency) return;
      await prisma.ghlInstallation.update({
        where: { agencyId: agency.id },
        data: { status: "UNINSTALLED", uninstalledAt: new Date() },
      });
      await prisma.location.updateMany({
        where: { agencyId: agency.id, status: "ACTIVE" },
        data: { status: "REMOVED", removedAt: new Date() },
      });
      break;
    }

    case "LocationCreate": {
      if (!payload.companyId || !payload.locationId) return;
      const agency = await prisma.agency.findUnique({ where: { ghlCompanyId: payload.companyId } });
      if (!agency) return;
      const location = await prisma.location.upsert({
        where: { ghlLocationId: payload.locationId },
        create: {
          agencyId: agency.id,
          ghlLocationId: payload.locationId,
          name: payload.locationName ?? payload.locationId,
          timezone: payload.timezone ?? "UTC",
          status: "ACTIVE",
        },
        update: { status: "ACTIVE", removedAt: null },
      });
      await seedSyncRunsForLocation(agency.id, location.id);
      break;
    }

    case "LocationUpdate": {
      if (!payload.locationId) return;
      await prisma.location.updateMany({
        where: { ghlLocationId: payload.locationId },
        data: {
          ...(payload.locationName ? { name: payload.locationName } : {}),
          ...(payload.timezone ? { timezone: payload.timezone } : {}),
        },
      });
      break;
    }

    case "AppInstall":
    case "AppUpdate":
      // Install is fully handled via the OAuth callback route; nothing
      // further to do here beyond the WebhookEvent audit row already written.
      break;

    default:
      break;
  }
}
