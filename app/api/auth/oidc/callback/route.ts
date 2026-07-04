import { NextResponse } from "next/server";
import { getAuthConfig } from "../../../../../lib/auth/config";
import {
  OIDC_STATE_COOKIE, getJwks, getOidcMetadata, publicOrigin, verifyIdToken, verifyStatePayload,
} from "../../../../../lib/auth/oidc";
import { createSession, isSecureRequest, sessionCookieHeader } from "../../../../../lib/auth/session";
import { provisionAutheliaUser } from "../../../../../lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readStateCookie(request: Request): string | null {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === OIDC_STATE_COOKIE) return rest.join("=") || null;
  }
  return null;
}

function clearStateCookieHeader(secure: boolean): string {
  return `${OIDC_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function failure(request: Request): NextResponse {
  const response = NextResponse.redirect(`${publicOrigin(request)}/login?error=oidc`);
  response.headers.set("Set-Cookie", clearStateCookieHeader(isSecureRequest(request)));
  return response;
}

export async function GET(request: Request) {
  const cfg = getAuthConfig();
  const origin = publicOrigin(request);
  if (!cfg.oidcEnabled || !cfg.sessionSecret) return failure(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = verifyStatePayload(readStateCookie(request) || "", cfg.sessionSecret);
  if (!code || !state || !stored || stored.state !== state || typeof stored.verifier !== "string") {
    return failure(request);
  }
  try {
    const metadata = await getOidcMetadata();
    if (!metadata) return failure(request);
    const tokenResponse = await fetch(metadata.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/auth/oidc/callback`,
        client_id: cfg.oidcClientId,
        client_secret: cfg.oidcClientSecret,
        code_verifier: stored.verifier,
      }),
    });
    if (!tokenResponse.ok) {
      console.error("OIDC token endpoint:", tokenResponse.status, await tokenResponse.text());
      return failure(request);
    }
    const tokens = await tokenResponse.json() as { id_token?: string };
    const jwks = tokens.id_token ? await getJwks(metadata.jwks_uri) : null;
    const claims = tokens.id_token && jwks
      ? verifyIdToken(tokens.id_token, { issuer: cfg.oidcIssuer, audience: cfg.oidcClientId, jwks })
      : null;
    const username = typeof claims?.preferred_username === "string" ? claims.preferred_username
      : typeof claims?.sub === "string" ? claims.sub : "";
    if (!claims || !username) return failure(request);
    const user = await provisionAutheliaUser({
      username,
      displayName: typeof claims.name === "string" ? claims.name : undefined,
      email: typeof claims.email === "string" ? claims.email : undefined,
      groups: Array.isArray(claims.groups) ? claims.groups.map(String) : [],
    });
    if (!user) {
      const response = NextResponse.redirect(`${origin}/login?error=inactive`);
      response.headers.set("Set-Cookie", clearStateCookieHeader(isSecureRequest(request)));
      return response;
    }
    const { token, maxAge } = await createSession(user.id);
    const response = NextResponse.redirect(`${origin}/`);
    response.headers.append("Set-Cookie", sessionCookieHeader(token, maxAge, isSecureRequest(request)));
    response.headers.append("Set-Cookie", clearStateCookieHeader(isSecureRequest(request)));
    return response;
  } catch (error) {
    console.error("OIDC callback:", error);
    return failure(request);
  }
}
