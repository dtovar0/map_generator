import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth/guard";
import { readRecord, validId } from "../../../../lib/maps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: { id: string } }) {
  const auth = await requireUser(request, "viewer");
  if (auth.response) return auth.response;
  const id = context.params.id;
  if (!validId(id)) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }
  try {
    const record = await readRecord(id);
    if (!record) {
      return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
    }
    const dates = Object.keys(record.days || {}).sort();
    const requestedDate = new URL(request.url).searchParams.get("date");
    const date = requestedDate || dates.at(-1) || null;
    if (!date || !record.days[date]) {
      return NextResponse.json({ error: "No hay información para la fecha", map: { id, name: record.name, dates } }, { status: 404 });
    }
    return NextResponse.json({
      map: { id: record.id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt, dates },
      date,
      snapshot: record.days[date],
    });
  } catch (error) {
    console.error("Maps read:", error);
    return NextResponse.json({ error: "No se pudo consultar el mapa" }, { status: 503 });
  }
}
