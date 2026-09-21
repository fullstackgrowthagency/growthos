import { prisma } from "@/server/db/prisma";
import { ghlRequest } from "@/server/ghl/client";
import { withRateLimit } from "@/server/ghl/rateLimiter";
import { getLocationToken } from "@/server/ghl/oauth";
import { normalizePayment, type GhlPayment } from "@/server/sync/normalize/payment";

const PAGE_LIMIT = 100;

interface PaymentsCursor {
  offset?: number;
}

type SyncCursor = Record<string, unknown> | null;

interface PaymentsResponse {
  data: GhlPayment[];
  meta?: { total?: number };
}

export async function syncPaymentsPage(
  agencyId: string,
  locationId: string,
  ghlLocationId: string,
  rawCursor: SyncCursor,
): Promise<{ nextCursor: PaymentsCursor | null; recordsSynced: number }> {
  const cursor = rawCursor as PaymentsCursor | null;
  const accessToken = await getLocationToken(locationId);
  const offset = cursor?.offset ?? 0;

  const page = await withRateLimit(agencyId, () =>
    ghlRequest<PaymentsResponse>("/payments/transactions", {
      accessToken,
      query: {
        locationId: ghlLocationId,
        limit: PAGE_LIMIT,
        offset,
      },
    }),
  );

  for (const raw of page.data) {
    const contactInternal = raw.contactId
      ? await prisma.contact.findUnique({
          where: { locationId_ghlContactId: { locationId, ghlContactId: raw.contactId } },
          select: { id: true },
        })
      : null;

    await prisma.payment.upsert(normalizePayment(raw, agencyId, locationId, contactInternal?.id ?? null));
  }

  const hasMore = page.data.length === PAGE_LIMIT;
  const nextCursor = hasMore ? { offset: offset + PAGE_LIMIT } : null;

  return { nextCursor, recordsSynced: page.data.length };
}
