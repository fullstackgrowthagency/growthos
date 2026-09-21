import type { Prisma, PaymentStatus } from "@prisma/client";

export interface GhlPayment {
  _id: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null; // "succeeded" | "pending" | "failed" | "refunded"
  source?: string | null; // "order" | "invoice" | "subscription"
  createdAt?: string | null;
  contactId?: string | null;
}

function mapStatus(status: string | null | undefined): PaymentStatus {
  switch ((status ?? "").toLowerCase()) {
    case "pending":
      return "PENDING";
    case "failed":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    default:
      return "SUCCEEDED";
  }
}

export function normalizePayment(
  raw: GhlPayment,
  agencyId: string,
  locationId: string,
  internalContactId: string | null,
): Prisma.PaymentUpsertArgs {
  const data = {
    agencyId,
    locationId,
    contactId: internalContactId,
    ghlTransactionId: raw._id,
    amount: raw.amount ?? 0,
    currency: raw.currency ?? "USD",
    status: mapStatus(raw.status),
    source: raw.source ?? null,
    occurredAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    raw: raw as unknown as Prisma.InputJsonValue,
  };

  return {
    where: { locationId_ghlTransactionId: { locationId, ghlTransactionId: raw._id } },
    create: data,
    update: data,
  };
}
