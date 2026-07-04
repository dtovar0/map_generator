import { NextResponse } from "next/server";
import { userFromForwardHeaders } from "./forward";
import { hasRole, type Role } from "./roles";
import { getSessionUser, readSessionToken } from "./session";
import type { AppUser } from "./users";

export type AuthResult =
  | { user: AppUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

export async function authenticate(request: Request): Promise<AppUser | null> {
  const token = readSessionToken(request);
  if (token) {
    const user = await getSessionUser(token);
    if (user) return user;
  }
  return userFromForwardHeaders(request);
}

export async function requireUser(request: Request, minRole: Role = "viewer"): Promise<AuthResult> {
  let user: AppUser | null = null;
  try {
    user = await authenticate(request);
  } catch (error) {
    console.error("Auth backend:", error);
    return { response: NextResponse.json({ error: "Servicio de autenticación no disponible" }, { status: 503 }) };
  }
  if (!user) return { response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (!hasRole(user.role, minRole)) {
    return { response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { user };
}
