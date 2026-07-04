import { NextResponse } from "next/server";
import { requireUser } from "../../../../../../lib/auth/guard";
import { listDataSources } from "../../../../../../lib/cacti/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: { id: string } }) {
  const auth = await requireUser(request, "viewer");
  if (auth.response) return auth.response;
  const hostId = Number(context.params.id);
  if (!Number.isInteger(hostId) || hostId < 1) return NextResponse.json({ error: "Dispositivo inválido" }, { status: 400 });
  try {
    const search = new URL(request.url).searchParams.get("search") || "";
    const dataSources = await listDataSources(hostId, search);
    return NextResponse.json({ dataSources });
  } catch (error) {
    console.error("Cacti data sources:", error);
    return NextResponse.json({ error: "No se pudieron consultar las fuentes de Cacti" }, { status: 502 });
  }
}
