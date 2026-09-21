import { prisma } from "@/server/db/prisma";
import { ghlRequest } from "@/server/ghl/client";
import { withRateLimit } from "@/server/ghl/rateLimiter";
import { getLocationToken } from "@/server/ghl/oauth";
import { normalizeAppointment, type GhlAppointment } from "@/server/sync/normalize/appointment";

const LOOKBACK_DAYS = Number(process.env.SYNC_LOOKBACK_DAYS ?? 180);

interface AppointmentsCursor {
  // Appointments are pulled by calendar events in a bounded time window;
  // the cursor here just tracks which window start we've completed.
  windowStartMs?: number;
}

type SyncCursor = Record<string, unknown> | null;

interface AppointmentsResponse {
  events: GhlAppointment[];
}

/**
 * Appointments/calendar events are windowed by time rather than
 * offset-paginated (matching how GHL's calendar events endpoint is
 * typically queried). One page == one lookback window; there's no partial
 * "more pages within a day" handling in phase 1 since per-location
 * appointment volume is expected to be modest.
 */
export async function syncAppointmentsPage(
  agencyId: string,
  locationId: string,
  ghlLocationId: string,
  rawCursor: SyncCursor,
): Promise<{ nextCursor: AppointmentsCursor | null; recordsSynced: number }> {
  const cursor = rawCursor as AppointmentsCursor | null;
  const accessToken = await getLocationToken(locationId);

  const startTime = cursor?.windowStartMs ?? Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const endTime = Date.now();

  const page = await withRateLimit(agencyId, () =>
    ghlRequest<AppointmentsResponse>("/calendars/events", {
      accessToken,
      query: {
        locationId: ghlLocationId,
        startTime,
        endTime,
      },
    }),
  );

  for (const raw of page.events) {
    const contactInternal = raw.contactId
      ? await prisma.contact.findUnique({
          where: { locationId_ghlContactId: { locationId, ghlContactId: raw.contactId } },
          select: { id: true },
        })
      : null;

    await prisma.appointment.upsert(
      normalizeAppointment(raw, agencyId, locationId, contactInternal?.id ?? null),
    );
  }

  // Single-window fetch — always complete after one page.
  return { nextCursor: null, recordsSynced: page.events.length };
}
