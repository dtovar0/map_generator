import { NextResponse } from "next/server";
import { getAuthConfig } from "../../../../lib/auth/config";
import { verifyPassword } from "../../../../lib/auth/passwords";
import { createSession, isSecureRequest, sessionCookieHeader } from "../../../../lib/auth/session";
import { getLocalUserForLogin } from "../../../../lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Small in-memory brake against credential stuffing: 5 failures per
// username lock the account name for 60 seconds.
const failures = new Map<string, { count: number; lockedUntil: number }>();

export async function POST(request: Request) {
  if (!getAuthConfig().localEnabled) {
    return NextResponse.json({ error: "El acceso local está deshabilitado" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!username || !password || username.length > 190) {
    return NextResponse.json({ error: "Usuario y contraseña son obligatorios" }, { status: 400 });
  }
  const lockKey = username.toLowerCase();
  const state = failures.get(lockKey);
  if (state && state.lockedUntil > Date.now()) {
    return NextResponse.json({ error: "Demasiados intentos; espera un minuto" }, { status: 423 });
  }
  try {
    const user = await getLocalUserForLogin(username);
    const valid = user?.active && user.passwordHash && (await verifyPassword(password, user.passwordHash));
    if (!user || !valid) {
      const next = { count: (state?.count || 0) + 1, lockedUntil: 0 };
      if (next.count >= 5) { next.count = 0; next.lockedUntil = Date.now() + 60_000; }
      failures.set(lockKey, next);
      return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }
    failures.delete(lockKey);
    const { token, maxAge } = await createSession(user.id);
    const response = NextResponse.json({ user: {
      id: user.id, username: user.username, displayName: user.displayName,
      role: user.role, provider: user.provider,
    }});
    response.headers.set("Set-Cookie", sessionCookieHeader(token, maxAge, isSecureRequest(request)));
    return response;
  } catch (error) {
    console.error("Login local:", error);
    return NextResponse.json({ error: "Servicio de autenticación no disponible" }, { status: 503 });
  }
}
