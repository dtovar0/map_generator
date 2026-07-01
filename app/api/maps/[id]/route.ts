import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mapsDirectory = path.join(process.cwd(), "data", "maps");

interface MapRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  days: Record<string, unknown>;
}

export async function GET(request: Request, context: { params: { id: string } }) {
  const id = context.params.id;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }
  try {
    const record = JSON.parse(await readFile(path.join(mapsDirectory, `${id}.json`), "utf8")) as MapRecord;
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
  } catch {
    return NextResponse.json({ error: "Mapa no encontrado" }, { status: 404 });
  }
}
