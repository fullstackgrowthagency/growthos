import type { Prisma, AppointmentStatus } from "@prisma/client";

export interface GhlAppointment {
  id: string;
  calendarId?: string | null;
  title?: string | null;
  startTime: string;
  endTime?: string | null;
  appointmentStatus?: string | null; // "confirmed" | "showed" | "noshow" | "cancelled" | "new"
  assignedUserId?: string | null;
  contactId?: string | null;
}

function mapStatus(status: string | null | undefined): AppointmentStatus {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return "CONFIRMED";
    case "showed":
      return "SHOWED";
    case "noshow":
      return "NOSHOW";
    case "cancelled":
      return "CANCELLED";
    default:
      return "BOOKED";
  }
}

export function normalizeAppointment(
  raw: GhlAppointment,
  agencyId: string,
  locationId: string,
  internalContactId: string | null,
): Prisma.AppointmentUpsertArgs {
  const data = {
    agencyId,
    locationId,
    contactId: internalContactId,
    ghlAppointmentId: raw.id,
    calendarId: raw.calendarId ?? null,
    title: raw.title ?? null,
    startTime: new Date(raw.startTime),
    endTime: raw.endTime ? new Date(raw.endTime) : null,
    status: mapStatus(raw.appointmentStatus),
    assignedGhlUserId: raw.assignedUserId ?? null,
    raw: raw as unknown as Prisma.InputJsonValue,
  };

  return {
    where: { locationId_ghlAppointmentId: { locationId, ghlAppointmentId: raw.id } },
    create: data,
    update: data,
  };
}
