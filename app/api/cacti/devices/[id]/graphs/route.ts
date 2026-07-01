import { NextResponse } from "next/server";
import { listGraphs } from "../../../../../../lib/cacti/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: { id: string } }) {
  const hostId = Number(context.params.id);
  if (!Number.isInteger(hostId) || hostId < 1) return NextResponse.json({ error:"Dispositivo inválido" }, { status:400 });
  try {
    const search = new URL(request.url).searchParams.get("search") || "";
    return NextResponse.json({ graphs:await listGraphs(hostId, search) });
  } catch (error) {
    console.error("Cacti graphs:", error);
    return NextResponse.json({ error:"No se pudieron consultar las gráficas de Cacti" }, { status:502 });
  }
}
