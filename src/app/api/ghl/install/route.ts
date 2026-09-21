import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getRequestedScopes } from "@/server/ghl/scopes";

const AUTHORIZE_URL = "https://marketplace.gohighlevel.com/oauth/chooselocation";
const STATE_COOKIE = "ghl_oauth_state";

/**
 * Kicks off the agency-level (Company) install flow: HighLevel's
 * bulk-install model means the agency owner authorizes once and the app
 * receives a company-level token, from which per-location tokens are
 * later minted.
 */
export async function GET() {
  const clientId = process.env.GHL_CLIENT_ID;
  const redirectUri = process.env.GHL_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "GHL_CLIENT_ID or GHL_REDIRECT_URI not configured" }, { status: 500 });
  }

  const state = randomBytes(24).toString("hex");

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", getRequestedScopes());
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return res;
}
