import { prisma } from "@/server/db/prisma";
import { decryptToken, encryptToken } from "@/server/crypto/tokenCipher";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const LOCATION_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/locationToken";
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const REFRESH_LOCK_WAIT_MS = 500;
const REFRESH_LOCK_MAX_WAIT_MS = 5000;

interface GhlTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  companyId: string;
  userId?: string;
  locationId?: string;
}

function clientCredentials() {
  const client_id = process.env.GHL_CLIENT_ID;
  const client_secret = process.env.GHL_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    throw new Error("GHL_CLIENT_ID / GHL_CLIENT_SECRET are not configured");
  }
  return { client_id, client_secret };
}

/** Step 2 of the install flow: exchange the authorization code for tokens. */
export async function exchangeCodeForTokens(code: string): Promise<GhlTokenResponse> {
  const { client_id, client_secret } = clientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id,
      client_secret,
      code,
      redirect_uri: process.env.GHL_REDIRECT_URI ?? "",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as GhlTokenResponse;
}

async function refreshAgencyToken(installationId: string, refreshToken: string): Promise<GhlTokenResponse> {
  const { client_id, client_secret } = clientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id,
      client_secret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL token refresh failed for installation ${installationId} (${res.status}): ${text}`);
  }
  return (await res.json()) as GhlTokenResponse;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a valid (non-expired) agency-level access token for the given
 * agency, refreshing it first if needed.
 *
 * HighLevel rotates the refresh token on every use, so a naive
 * "read token, refresh, write token" sequence run concurrently by two
 * callers (e.g. a cron tick and a manual "Refresh Now") can have the
 * second refresh silently invalidate the first. `isRefreshing` is used as
 * a simple mutex: the first caller claims it inside a transaction, does
 * the refresh, and clears it; a second caller that finds it already set
 * polls briefly and re-reads the (by-then-updated) token instead of
 * refreshing again.
 */
export async function getValidAgencyToken(agencyId: string): Promise<string> {
  let installation = await prisma.ghlInstallation.findUniqueOrThrow({ where: { agencyId } });

  const needsRefresh = installation.expiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;
  if (!needsRefresh) {
    return decryptToken(installation.accessTokenEnc);
  }

  const waitStart = Date.now();
  while (installation.isRefreshing) {
    if (Date.now() - waitStart > REFRESH_LOCK_MAX_WAIT_MS) {
      break; // stale lock (crashed refresh) — fall through and take over
    }
    await sleep(REFRESH_LOCK_WAIT_MS);
    installation = await prisma.ghlInstallation.findUniqueOrThrow({ where: { agencyId } });
    if (installation.expiresAt.getTime() - Date.now() >= REFRESH_BUFFER_MS) {
      return decryptToken(installation.accessTokenEnc);
    }
  }

  const claimed = await prisma.ghlInstallation.updateMany({
    where: { agencyId, isRefreshing: false },
    data: { isRefreshing: true },
  });

  if (claimed.count === 0) {
    // Someone else claimed it between our checks — read whatever they end up with.
    await sleep(REFRESH_LOCK_WAIT_MS);
    installation = await prisma.ghlInstallation.findUniqueOrThrow({ where: { agencyId } });
    return decryptToken(installation.accessTokenEnc);
  }

  try {
    const refreshToken = decryptToken(installation.refreshTokenEnc);
    const tokens = await refreshAgencyToken(installation.id, refreshToken);
    await prisma.ghlInstallation.update({
      where: { agencyId },
      data: {
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        scope: tokens.scope,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isRefreshing: false,
      },
    });
    return tokens.access_token;
  } catch (err) {
    await prisma.ghlInstallation.update({
      where: { agencyId },
      data: { isRefreshing: false },
    });
    throw err;
  }
}

/**
 * Mints (or returns a cached, still-valid) location-scoped access token.
 * There is no refresh token for location tokens — expiry is handled by
 * re-minting from a valid agency token.
 */
export async function getLocationToken(locationId: string): Promise<string> {
  const location = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
    include: { token: true },
  });

  if (location.token && location.token.expiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return decryptToken(location.token.accessTokenEnc);
  }

  const agencyAccessToken = await getValidAgencyToken(location.agencyId);
  const { client_id } = clientCredentials();

  const res = await fetch(LOCATION_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agencyAccessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Version: process.env.GHL_API_VERSION ?? "2021-07-28",
    },
    body: new URLSearchParams({
      companyId: (await prisma.agency.findUniqueOrThrow({ where: { id: location.agencyId } })).ghlCompanyId,
      locationId: location.ghlLocationId,
      client_id,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL location token mint failed for location ${location.ghlLocationId} (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 24 * 60 * 60) * 1000);

  await prisma.locationToken.upsert({
    where: { locationId },
    create: {
      locationId,
      accessTokenEnc: encryptToken(data.access_token),
      expiresAt,
    },
    update: {
      accessTokenEnc: encryptToken(data.access_token),
      expiresAt,
      mintedAt: new Date(),
    },
  });

  return data.access_token;
}
