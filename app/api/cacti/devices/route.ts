import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth/guard";
import { listDevices } from "../../../../lib/cacti/catalog";
import { getCactiConfig } from "../../../../lib/cacti/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request, "viewer");
  if (auth.response) return auth.response;
  if (!getCactiConfig().enabled) return NextResponse.json({ error: "Cacti está deshabilitado" }, { status: 503 });
  try {
    const search = new URL(request.url).searchParams.get("search") || "";
    return NextResponse.json({ devices: await listDevices(search) });
  } catch (error) {
    console.error("Cacti devices:", error);
    return NextResponse.json({ error: "No se pudo consultar el catálogo de Cacti" }, { status: 502 });
  }
}
