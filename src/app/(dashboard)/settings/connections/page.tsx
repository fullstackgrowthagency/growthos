import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/authOptions";
import { prisma } from "@/server/db/prisma";
import { Card } from "@/components/ui/Card";

export default async function ConnectionsPage() {
  const session = await getServerSession(authOptions);
  const agencyId = session!.user.agencyId;

  const [installation, locations] = await Promise.all([
    prisma.ghlInstallation.findUnique({ where: { agencyId } }),
    prisma.location.findMany({ where: { agencyId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Connections</h1>
        <p className="text-sm text-muted-foreground">Your HighLevel install and synced sub-accounts.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">HighLevel</div>
            <div className="text-sm text-muted-foreground">
              Company ID: {installation?.ghlCompanyId ?? "—"}
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              installation?.status === "ACTIVE"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
            }`}
          >
            {installation?.status ?? "NOT INSTALLED"}
          </span>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Sub-Accounts ({locations.length})</h2>
        <Card className="divide-y divide-border">
          {locations.length === 0 && (
            <div className="p-5 text-sm text-muted-foreground">No sub-accounts synced yet.</div>
          )}
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="font-medium">{loc.name}</div>
                <div className="text-muted-foreground">{loc.ghlLocationId}</div>
              </div>
              <div className="text-right text-muted-foreground">
                <div>{loc.status}</div>
                <div>{loc.lastSyncedAt ? `Synced ${new Date(loc.lastSyncedAt).toLocaleString()}` : "Never synced"}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
