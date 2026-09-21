import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/server/auth/authOptions";
import { prisma } from "@/server/db/prisma";

const bodySchema = z.object({
  locationId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/), // "2026-09"
  amount: z.number().nonnegative(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { locationId, month, amount } = parsed.data;

  const location = await prisma.location.findFirst({
    where: { id: locationId, agencyId: session.user.agencyId },
  });
  if (!location) {
    return NextResponse.json({ error: "Unknown location" }, { status: 404 });
  }

  const monthDate = new Date(`${month}-01T00:00:00.000Z`);

  await prisma.adSpend.upsert({
    where: { locationId_month: { locationId, month: monthDate } },
    create: { locationId, month: monthDate, amount },
    update: { amount },
  });

  return NextResponse.json({ ok: true });
}
