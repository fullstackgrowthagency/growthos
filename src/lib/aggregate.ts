import { prisma } from "@/server/db/prisma";
import { computeHealthScore } from "@/lib/health";

export interface DateRange {
  start: Date;
  end: Date;
}

export function lastNDaysRange(days: number): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function thisMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: now };
}

export interface AgencyOverview {
  activeClients: number;
  revenue: number;
  leads: number;
  opportunitiesWon: number;
  closeRate: number | null;
  avgCpl: number | null;
}

export async function getAgencyOverview(agencyId: string, range: DateRange): Promise<AgencyOverview> {
  const [activeClients, revenueAgg, leads, won, total, spendAgg] = await Promise.all([
    prisma.location.count({ where: { agencyId, status: "ACTIVE" } }),
    prisma.payment.aggregate({
      where: { agencyId, status: "SUCCEEDED", occurredAt: { gte: range.start, lte: range.end } },
      _sum: { amount: true },
    }),
    prisma.contact.count({ where: { agencyId, dateAddedGhl: { gte: range.start, lte: range.end } } }),
    prisma.opportunity.count({
      where: { agencyId, status: "WON", updatedAtGhl: { gte: range.start, lte: range.end } },
    }),
    prisma.opportunity.count({
      where: { agencyId, createdAtGhl: { gte: range.start, lte: range.end } },
    }),
    prisma.adSpend.aggregate({
      where: { location: { agencyId }, month: { gte: range.start, lte: range.end } },
      _sum: { amount: true },
    }),
  ]);

  const spend = spendAgg._sum.amount ? Number(spendAgg._sum.amount) : null;

  return {
    activeClients,
    revenue: Number(revenueAgg._sum.amount ?? 0),
    leads,
    opportunitiesWon: won,
    closeRate: total > 0 ? won / total : null,
    avgCpl: spend !== null && leads > 0 ? spend / leads : null,
  };
}

export interface ClientHealthRow {
  locationId: string;
  name: string;
  leads: number;
  opportunitiesWon: number;
  revenue: number;
  appointments: number;
  showRate: number | null;
  lastSyncedAt: Date | null;
  healthScore: number;
}

export async function getClientHealthTable(agencyId: string, range: DateRange): Promise<ClientHealthRow[]> {
  const locations = await prisma.location.findMany({
    where: { agencyId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    locations.map(async (location) => {
      const [leads, revenueAgg, won, total, appointments, showed, noShow] = await Promise.all([
        prisma.contact.count({
          where: { locationId: location.id, dateAddedGhl: { gte: range.start, lte: range.end } },
        }),
        prisma.payment.aggregate({
          where: {
            locationId: location.id,
            status: "SUCCEEDED",
            occurredAt: { gte: range.start, lte: range.end },
          },
          _sum: { amount: true },
        }),
        prisma.opportunity.count({
          where: { locationId: location.id, status: "WON", updatedAtGhl: { gte: range.start, lte: range.end } },
        }),
        prisma.opportunity.count({
          where: { locationId: location.id, createdAtGhl: { gte: range.start, lte: range.end } },
        }),
        prisma.appointment.count({
          where: { locationId: location.id, startTime: { gte: range.start, lte: range.end } },
        }),
        prisma.appointment.count({
          where: { locationId: location.id, status: "SHOWED", startTime: { gte: range.start, lte: range.end } },
        }),
        prisma.appointment.count({
          where: { locationId: location.id, status: "NOSHOW", startTime: { gte: range.start, lte: range.end } },
        }),
      ]);

      const daysSinceLastSync = location.lastSyncedAt
        ? Math.floor((Date.now() - location.lastSyncedAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      const healthScore = computeHealthScore({
        leadsInRange: leads,
        appointmentsInRange: appointments,
        showedCount: showed,
        noShowCount: noShow,
        opportunitiesWon: won,
        opportunitiesTotal: total,
        daysSinceLastSync,
      });

      return {
        locationId: location.id,
        name: location.name,
        leads,
        opportunitiesWon: won,
        revenue: Number(revenueAgg._sum.amount ?? 0),
        appointments,
        showRate: showed + noShow > 0 ? showed / (showed + noShow) : null,
        lastSyncedAt: location.lastSyncedAt,
        healthScore,
      };
    }),
  );
}
