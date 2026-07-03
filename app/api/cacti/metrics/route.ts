import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth/guard";
import { getStoredMetrics } from "../../../../lib/cacti/catalog";
import { getCactiConfig } from "../../../../lib/cacti/config";
import { getRrdMetrics } from "../../../../lib/cacti/rrd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BindingRequest {
  linkId: string;
  localDataId: number;
  inDs?: string;
  outDs?: string;
  multiplier?: number;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "viewer");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { bindings?: BindingRequest[]; date?: string } | null;
  if (!body || !Array.isArray(body.bindings) || body.bindings.length > 500 || (body.date && !validDate(body.date))) {
    return NextResponse.json({ error: "Solicitud de métricas inválida" }, { status: 400 });
  }
  const validBindings = body.bindings.filter((binding) =>
    /^[a-zA-Z0-9_-]{1,80}$/.test(binding.linkId) && Number.isInteger(binding.localDataId));
  try {
    const source = getCactiConfig().metricsSource;
    const ids = validBindings.map((binding) => binding.localDataId);
    const stored = source === "rrd" ? await getRrdMetrics(ids, body.date) : await getStoredMetrics(ids, body.date);
    const metrics = validBindings.map((binding) => {
      const rows = stored.filter((row) => row.localDataId === binding.localDataId);
      const multiplier = Number.isFinite(Number(binding.multiplier)) ? Number(binding.multiplier) : 8;
      const read = (name: string | undefined) => {
        const value = rows.find((row) => row.dsName === name)?.valueRaw;
        return value == null ? null : Math.max(0, value * multiplier);
      };
      const timestamp = rows.reduce((latest, row) => Math.max(latest, row.timestamp), 0) || null;
      return { linkId:binding.linkId, localDataId:binding.localDataId, timestamp,
        inBps:read(binding.inDs), outBps:read(binding.outDs), availableDs:rows.map((row) => row.dsName),
        ...(!rows.length ? { error:source === "rrd" ? "El archivo RRD no contiene datos para este periodo" :
          (body.date ? "No hay muestras guardadas para esta fecha" : "El colector aún no ha guardado una muestra reciente") } : {}) };
    });
    return NextResponse.json({ mode: body.date ? "day" : "live", source, metrics });
  } catch (error) {
    console.error("Cacti metrics:", error);
    return NextResponse.json({ error:"No se pudieron consultar las métricas de Cacti" }, { status:502 });
  }
}
