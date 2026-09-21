import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";

const bodySchema = z.object({
  agencyId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

/**
 * Creates the first (OWNER) GrowthOS user for a freshly installed agency.
 * Only allowed once per agency — prevents anyone who finds the install
 * link from claiming ownership of someone else's install after the fact.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { agencyId, email, name } = parsed.data;

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) {
    return NextResponse.json({ error: "Unknown agency" }, { status: 404 });
  }

  const existingOwner = await prisma.user.findFirst({ where: { agencyId } });
  if (existingOwner) {
    return NextResponse.json({ error: "This agency already has an account" }, { status: 409 });
  }

  await prisma.user.create({
    data: { agencyId, email, name, role: "OWNER" },
  });

  return NextResponse.json({ ok: true });
}
