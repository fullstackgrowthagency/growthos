import { Card } from "@/components/ui/Card";
import { healthTier, type HealthTier } from "@/lib/health";
import type { ClientHealthRow } from "@/lib/aggregate";

const TIER_STYLES: Record<HealthTier, string> = {
  healthy: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  watch: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "at-risk": "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = (n: number) => `${Math.round(n * 100)}%`;

export function ClientHealthTable({ rows }: { rows: ClientHealthRow[] }) {
  const sorted = [...rows].sort((a, b) => a.healthScore - b.healthScore);

  if (sorted.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No sub-accounts synced yet. Install GrowthOS on a HighLevel agency and trigger a sync from Settings →
        Connections.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium text-right">Leads</th>
            <th className="px-4 py-3 font-medium text-right">Appointments</th>
            <th className="px-4 py-3 font-medium text-right">Show Rate</th>
            <th className="px-4 py-3 font-medium text-right">Won</th>
            <th className="px-4 py-3 font-medium text-right">Revenue</th>
            <th className="px-4 py-3 font-medium text-right">Last Synced</th>
            <th className="px-4 py-3 font-medium text-right">Health</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const tier = healthTier(row.healthScore);
            return (
              <tr key={row.locationId} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.leads}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.appointments}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.showRate !== null ? percent(row.showRate) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{row.opportunitiesWon}</td>
                <td className="px-4 py-3 text-right tabular-nums">{currency.format(row.revenue)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TIER_STYLES[tier]}`}>
                    {row.healthScore}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
