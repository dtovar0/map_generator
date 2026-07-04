import { NextResponse } from "next/server";
import { getAuthConfig } from "../../../../lib/auth/config";
import { authenticate } from "../../../../lib/auth/guard";
import { isSecureRequest, readSessionToken, sessionCookieHeader } from "../../../../lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = getAuthConfig();
  const modes = { local: cfg.localEnabled, oidc: cfg.oidcEnabled };
  try {
    const user = await authenticate(request);
    const response = NextResponse.json({
      user: user ? {
        id: user.id, username: user.username, displayName: user.displayName,
        role: user.role, provider: user.provider,
      } : null,
      modes,
    });
    const token = readSessionToken(request);
    // Browser-side sliding: the DB already extends the session; re-stamp the
    // cookie's Max-Age on app load so an active user's cookie never outlives it.
    if (user && token) {
      response.headers.set("Set-Cookie", sessionCookieHeader(token, cfg.sessionTtlHours * 3600, isSecureRequest(request)));
    }
    return response;
  } catch (error) {
    console.error("Auth me:", error);
    return NextResponse.json({ user: null, modes }, { status: 200 });
  }
}
