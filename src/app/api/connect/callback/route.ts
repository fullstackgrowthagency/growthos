import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { exchangeCodeForTokens } from "@/server/ghl/oauth";
import { encryptToken } from "@/server/crypto/tokenCipher";
import { ghlRequest } from "@/server/ghl/client";
import { seedSyncRunsForLocation } from "@/server/sync/runSync";

const STATE_COOKIE = "ghl_oauth_state";

interface InstalledLocationsResponse {
  locations: Array<{ _id: string; name: string; timezone?: string }>;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: "Invalid or missing state (possible CSRF)" }, { status: 400 });
  }

  const tokens = await exchangeCodeForTokens(code);

  const agency = await prisma.agency.upsert({
    where: { ghlCompanyId: tokens.companyId },
    create: { ghlCompanyId: tokens.companyId, name: tokens.companyId },
    update: {},
  });

  await prisma.ghlInstallation.upsert({
    where: { agencyId: agency.id },
    create: {
      agencyId: agency.id,
      ghlCompanyId: tokens.companyId,
      ghlInstallerUserId: tokens.userId ?? null,
      accessTokenEnc: encryptToken(tokens.access_token),
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      scope: tokens.scope,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accessTokenEnc: encryptToken(tokens.access_token),
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      scope: tokens.scope,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      uninstalledAt: null,
    },
  });

  const installedLocations = await ghlRequest<InstalledLocationsResponse>("/oauth/installedLocations", {
    accessToken: tokens.access_token,
    query: { companyId: tokens.companyId },
  });

  for (const loc of installedLocations.locations ?? []) {
    const location = await prisma.location.upsert({
      where: { ghlLocationId: loc._id },
      create: {
        agencyId: agency.id,
        ghlLocationId: loc._id,
        name: loc.name,
        timezone: loc.timezone ?? "UTC",
        status: "ACTIVE",
      },
      update: { name: loc.name, status: "ACTIVE", removedAt: null },
    });
    await seedSyncRunsForLocation(agency.id, location.id);
  }

  const existingUser = await prisma.user.findFirst({ where: { agencyId: agency.id } });
  const redirectPath = existingUser ? "/dashboard" : "/onboarding/create-account";

  const res = NextResponse.redirect(new URL(`${redirectPath}?agencyId=${agency.id}`, req.nextUrl.origin));
  res.cookies.delete(STATE_COOKIE);
  return res;
}
