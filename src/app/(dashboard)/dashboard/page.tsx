import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/authOptions";
import { getAgencyOverview, getClientHealthTable, lastNDaysRange, thisMonthRange } from "@/lib/aggregate";
import { StatTile } from "@/components/dashboard/StatTile";
import { ClientHealthTable } from "@/components/dashboard/ClientHealthTable";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { RefreshButton } from "@/components/dashboard/RefreshButton";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function resolveRange(rangeParam: string | undefined) {
  if (rangeParam === "month") return thisMonthRange();
  if (rangeParam === "90") return lastNDaysRange(90);
  return lastNDaysRange(30);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const session = await getServerSession(authOptions);
  const agencyId = session!.user.agencyId;
  const range = resolveRange(searchParams.range);

  const [overview, clientRows] = await Promise.all([
    getAgencyOverview(agencyId, range),
    getClientHealthTable(agencyId, range),
  ]);

  const needsAttention = clientRows.filter((row) => row.healthScore < 60);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agency Performance</h1>
          <p className="text-sm text-muted-foreground">Portfolio-level view across every connected sub-account.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker />
          <RefreshButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Clients" value={String(overview.activeClients)} />
        <StatTile label="Revenue" value={currency.format(overview.revenue)} />
        <StatTile label="Leads" value={String(overview.leads)} />
        <StatTile label="Deals Won" value={String(overview.opportunitiesWon)} />
        <StatTile
          label="Close Rate"
          value={overview.closeRate !== null ? `${Math.round(overview.closeRate * 100)}%` : "—"}
        />
        <StatTile
          label="Avg CPL"
          value={overview.avgCpl !== null ? currency.format(overview.avgCpl) : "—"}
          hint={overview.avgCpl === null ? "Add ad spend under Settings" : undefined}
        />
      </div>

      {needsAttention.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">{needsAttention.length} client{needsAttention.length === 1 ? "" : "s"}</span>{" "}
          scoring below 60 — see the table below for who needs attention first.
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-medium">Client Health</h2>
        <ClientHealthTable rows={clientRows} />
      </div>
    </div>
  );
}
