import { mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";
import { mapsDirectory, readRecord, validId } from "../../../../lib/maps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!validId(id)) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }
  await mkdir(mapsDirectory, { recursive: true });
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
    map: { id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt, dates },
    date,
    snapshot: record.days[date],
  });
}
