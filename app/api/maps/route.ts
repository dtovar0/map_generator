import { NextResponse } from "next/server";
import { listMaps, saveDay, validDate, validSnapshot, validId } from "../../../lib/maps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ maps: await listMaps() });
  } catch (error) {
    console.error("Maps list:", error);
    return NextResponse.json({ error: "No se pudieron consultar los mapas" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !validDate(body.date) || !validSnapshot(body.snapshot)) {
    return NextResponse.json({ error: "Datos de mapa inválidos" }, { status: 400 });
  }
  try {
    const map = await saveDay({
      id: validId(body.id) ? body.id : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      date: body.date,
      snapshot: body.snapshot as Record<string, unknown>,
      userId: null,
    });
    return NextResponse.json({ map });
  } catch (error) {
    console.error("Maps save:", error);
    return NextResponse.json({ error: "No se pudo guardar el mapa" }, { status: 503 });
  }
}
