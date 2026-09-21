import type { Prisma } from "@prisma/client";

/** Shape of a contact object as returned by GHL's /contacts endpoints. */
export interface GhlContact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[];
  dateAdded?: string | null;
}

export function normalizeContact(
  raw: GhlContact,
  agencyId: string,
  locationId: string,
): Prisma.ContactUpsertArgs {
  const data = {
    agencyId,
    locationId,
    ghlContactId: raw.id,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    source: raw.source ?? null,
    tags: raw.tags ?? [],
    dateAddedGhl: raw.dateAdded ? new Date(raw.dateAdded) : null,
    raw: raw as unknown as Prisma.InputJsonValue,
  };

  return {
    where: { locationId_ghlContactId: { locationId, ghlContactId: raw.id } },
    create: data,
    update: data,
  };
}
