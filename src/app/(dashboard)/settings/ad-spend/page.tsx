import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/authOptions";
import { prisma } from "@/server/db/prisma";
import { AdSpendForm } from "./AdSpendForm";

export default async function AdSpendPage() {
  const session = await getServerSession(authOptions);
  const agencyId = session!.user.agencyId;

  const locations = await prisma.location.findMany({
    where: { agencyId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ad Spend</h1>
        <p className="text-sm text-muted-foreground">
          HighLevel&rsquo;s API doesn&rsquo;t expose ad spend, so average CPL on the dashboard is computed from these
          manual entries. Locations with no spend entered for a period show &ldquo;&mdash;&rdquo; instead of a
          fabricated number.
        </p>
      </div>

      <AdSpendForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
    </div>
  );
}
