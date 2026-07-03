import { NextResponse } from "next/server";
import { clearSessionCookieHeader, destroySession, isSecureRequest, readSessionToken } from "../../../../lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = readSessionToken(request);
  if (token) await destroySession(token).catch((error) => console.error("Logout:", error));
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Set-Cookie", clearSessionCookieHeader(isSecureRequest(request)));
  return response;
}
