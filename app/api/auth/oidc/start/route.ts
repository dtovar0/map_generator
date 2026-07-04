import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthConfig } from "../../../../../lib/auth/config";
import { OIDC_STATE_COOKIE, getOidcMetadata, publicOrigin, signStatePayload } from "../../../../../lib/auth/oidc";
import { isSecureRequest } from "../../../../../lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = getAuthConfig();
  const origin = publicOrigin(request);
  if (!cfg.oidcEnabled || !cfg.oidcClientId || !cfg.sessionSecret) {
    return NextResponse.redirect(`${origin}/login?error=oidc`);
  }
  const metadata = await getOidcMetadata();
  if (!metadata) return NextResponse.redirect(`${origin}/login?error=oidc`);

  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${origin}/api/auth/oidc/callback`;

  const authorize = new URL(metadata.authorization_endpoint);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", cfg.oidcClientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "openid profile email groups");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const payload = signStatePayload({ state, verifier, exp: Math.floor(Date.now() / 1000) + 600 }, cfg.sessionSecret);
  const response = NextResponse.redirect(authorize);
  response.headers.set(
    "Set-Cookie",
    `${OIDC_STATE_COOKIE}=${payload}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecureRequest(request) ? "; Secure" : ""}`,
  );
  return response;
}
