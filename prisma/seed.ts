/**
 * Optional local-dev seed. Real data comes from GHL sync — this only
 * exists to smoke-test the dashboard UI against fixture rows without
 * needing a live GHL install every time.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const agency = await prisma.agency.upsert({
    where: { ghlCompanyId: "seed-company" },
    create: { ghlCompanyId: "seed-company", name: "Seed Agency" },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "owner@seed-agency.test" },
    create: { agencyId: agency.id, email: "owner@seed-agency.test", role: "OWNER", name: "Seed Owner" },
    update: {},
  });

  const location = await prisma.location.upsert({
    where: { ghlLocationId: "seed-location-1" },
    create: { agencyId: agency.id, ghlLocationId: "seed-location-1", name: "Seed Roofing Co.", status: "ACTIVE" },
    update: {},
  });

  await prisma.contact.upsert({
    where: { locationId_ghlContactId: { locationId: location.id, ghlContactId: "seed-contact-1" } },
    create: {
      agencyId: agency.id,
      locationId: location.id,
      ghlContactId: "seed-contact-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      dateAddedGhl: new Date(),
    },
    update: {},
  });

  console.log(`Seeded agency ${agency.id} with location ${location.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
