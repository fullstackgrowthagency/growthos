import { prisma } from "@/server/db/prisma";
import { ghlRequest } from "@/server/ghl/client";
import { withRateLimit } from "@/server/ghl/rateLimiter";
import { getLocationToken } from "@/server/ghl/oauth";
import { normalizeContact, type GhlContact } from "@/server/sync/normalize/contact";

const PAGE_LIMIT = 100;

interface ContactsPageCursor {
  startAfter?: string;
  startAfterId?: string;
}

type SyncCursor = Record<string, unknown> | null;

function asContactsCursor(cursor: SyncCursor): ContactsPageCursor | null {
  return cursor as ContactsPageCursor | null;
}

interface ContactsResponse {
  contacts: GhlContact[];
  meta?: { startAfter?: string; startAfterId?: string; total?: number };
}

/**
 * Syncs one page of contacts for a location, starting from `cursor`.
 * Returns the cursor to resume from next time, or `null` once the
 * location's contacts are fully synced (subsequent runs restart from
 * scratch — cheap given the upsert-by-ghlContactId idempotency).
 */
export async function syncContactsPage(
  agencyId: string,
  locationId: string,
  ghlLocationId: string,
  rawCursor: SyncCursor,
): Promise<{ nextCursor: ContactsPageCursor | null; recordsSynced: number }> {
  const cursor = asContactsCursor(rawCursor);
  const accessToken = await getLocationToken(locationId);

  const page = await withRateLimit(agencyId, () =>
    ghlRequest<ContactsResponse>("/contacts/", {
      accessToken,
      query: {
        locationId: ghlLocationId,
        limit: PAGE_LIMIT,
        startAfter: cursor?.startAfter,
        startAfterId: cursor?.startAfterId,
      },
    }),
  );

  for (const raw of page.contacts) {
    await prisma.contact.upsert(normalizeContact(raw, agencyId, locationId));
  }

  const hasMore = page.contacts.length === PAGE_LIMIT;
  const nextCursor =
    hasMore && page.meta?.startAfter && page.meta?.startAfterId
      ? { startAfter: page.meta.startAfter, startAfterId: page.meta.startAfterId }
      : null;

  return { nextCursor, recordsSynced: page.contacts.length };
}
