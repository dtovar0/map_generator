import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth/guard";
import { isRole } from "../../../../lib/auth/roles";
import { createLocalUser, listUsers } from "../../../../lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!/^[a-zA-Z0-9._@-]{2,190}$/.test(username) || password.length < 8 || !isRole(body?.role)) {
    return NextResponse.json({ error: "Datos de usuario inválidos (contraseña mínima: 8 caracteres)" }, { status: 400 });
  }
  try {
    const user = await createLocalUser({
      username,
      password,
      displayName: typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 190) : undefined,
      email: typeof body?.email === "string" ? body.email.trim().slice(0, 190) : undefined,
      role: body.role,
    });
    return NextResponse.json({ user });
  } catch (error) {
    if ((error as Error).message === "duplicate") {
      return NextResponse.json({ error: "Ese nombre de usuario ya existe" }, { status: 409 });
    }
    console.error("Users create:", error);
    return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 503 });
  }
}
