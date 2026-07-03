import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/auth/guard";
import { isRole } from "../../../../../lib/auth/roles";
import { countActiveAdmins, deleteUser, getUserById, setUserPassword, updateUser } from "../../../../../lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// True when the change would leave the system without an active admin.
async function wouldOrphanAdmins(targetId: number, patch: { role?: string; active?: boolean }): Promise<boolean> {
  const target = await getUserById(targetId);
  if (!target || target.role !== "admin" || !target.active) return false;
  const demoted = (patch.role !== undefined && patch.role !== "admin") || patch.active === false;
  return demoted && (await countActiveAdmins()) <= 1;
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  if (body.role !== undefined && !isRole(body.role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }
  if (body.password !== undefined && String(body.password).length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }
  try {
    const patch = {
      ...(isRole(body.role) ? { role: body.role } : {}),
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(typeof body.displayName === "string" ? { displayName: body.displayName.trim().slice(0, 190) } : {}),
    };
    if (await wouldOrphanAdmins(id, patch)) {
      return NextResponse.json({ error: "No puedes dejar el sistema sin administradores activos" }, { status: 409 });
    }
    await updateUser(id, patch);
    if (typeof body.password === "string") await setUserPassword(id, body.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Users update:", error);
    return NextResponse.json({ error: "No se pudo actualizar el usuario" }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const auth = await requireUser(request, "admin");
  if (auth.response) return auth.response;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  try {
    if (await wouldOrphanAdmins(id, { active: false })) {
      return NextResponse.json({ error: "No puedes eliminar al último administrador activo" }, { status: 409 });
    }
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Users delete:", error);
    return NextResponse.json({ error: "No se pudo eliminar el usuario" }, { status: 503 });
  }
}
