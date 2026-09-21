import { prisma } from "@/server/db/prisma";
import { ghlRequest } from "@/server/ghl/client";
import { withRateLimit } from "@/server/ghl/rateLimiter";
import { getLocationToken } from "@/server/ghl/oauth";
import { normalizeOpportunity, type GhlOpportunity } from "@/server/sync/normalize/opportunity";

const PAGE_LIMIT = 100;

interface OpportunitiesPageCursor {
  startAfter?: string;
  startAfterId?: string;
}

type SyncCursor = Record<string, unknown> | null;

interface OpportunitiesResponse {
  opportunities: GhlOpportunity[];
  meta?: { startAfter?: string; startAfterId?: string; total?: number };
}

export async function syncOpportunitiesPage(
  agencyId: string,
  locationId: string,
  ghlLocationId: string,
  rawCursor: SyncCursor,
): Promise<{ nextCursor: OpportunitiesPageCursor | null; recordsSynced: number }> {
  const cursor = rawCursor as OpportunitiesPageCursor | null;
  const accessToken = await getLocationToken(locationId);

  const page = await withRateLimit(agencyId, () =>
    ghlRequest<OpportunitiesResponse>("/opportunities/search", {
      accessToken,
      query: {
        location_id: ghlLocationId,
        limit: PAGE_LIMIT,
        startAfter: cursor?.startAfter,
        startAfterId: cursor?.startAfterId,
      },
    }),
  );

  for (const raw of page.opportunities) {
    const contactInternal = raw.contactId
      ? await prisma.contact.findUnique({
          where: { locationId_ghlContactId: { locationId, ghlContactId: raw.contactId } },
          select: { id: true },
        })
      : null;

    await prisma.opportunity.upsert(
      normalizeOpportunity(raw, agencyId, locationId, contactInternal?.id ?? null),
    );
  }

  const hasMore = page.opportunities.length === PAGE_LIMIT;
  const nextCursor =
    hasMore && page.meta?.startAfter && page.meta?.startAfterId
      ? { startAfter: page.meta.startAfter, startAfterId: page.meta.startAfterId }
      : null;

  return { nextCursor, recordsSynced: page.opportunities.length };
}
