import { NextResponse } from "next/server";
import { getAuthConfig } from "../../../../lib/auth/config";
import { authenticate } from "../../../../lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = getAuthConfig();
  const modes = { local: cfg.localEnabled, oidc: cfg.oidcEnabled };
  try {
    const user = await authenticate(request);
    return NextResponse.json({
      user: user ? {
        id: user.id, username: user.username, displayName: user.displayName,
        role: user.role, provider: user.provider,
      } : null,
      modes,
    });
  } catch (error) {
    console.error("Auth me:", error);
    return NextResponse.json({ user: null, modes }, { status: 200 });
  }
}
