import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth/guard";
import { getStoredSeries } from "../../../../lib/cacti/catalog";
import { getCactiConfig } from "../../../../lib/cacti/config";
import { getRrdSeries, type RrdConsolidation } from "../../../../lib/cacti/rrd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ranges = new Set(["1h", "6h", "24h", "7d", "30d", "90d", "1y"]);
const consolidations = new Set(["AVERAGE", "MIN", "MAX", "LAST"]);
const steps = new Set([0, 60, 300, 900, 1800, 3600, 14400, 21600, 43200, 86400]);

interface SeriesRequest {
  id?: string;
  localDataId: number;
  dsName: string;
  multiplier?: number;
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "viewer");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as {
    range?: string; consolidation?: RrdConsolidation; step?: number; series?: SeriesRequest[];
  } | null;
  if (!body || !Array.isArray(body.series) || body.series.length > 24 || !ranges.has(body.range || "24h") ||
      !consolidations.has(body.consolidation || "AVERAGE") || !steps.has(Number(body.step) || 0)) {
    return NextResponse.json({error:"Solicitud de series de Cacti inválida"}, {status:400});
  }
  const valid = body.series.filter((item) => Number.isInteger(item.localDataId) &&
    typeof item.dsName === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(item.dsName));
  try {
    const source = getCactiConfig().metricsSource;
    const series = await Promise.all(valid.map(async (item) => {
      const multiplier = Number.isFinite(Number(item.multiplier)) ? Number(item.multiplier) : 1;
      const points = source === "rrd"
        ? await getRrdSeries(item.localDataId, item.dsName, body.range, body.consolidation, Number(body.step) || undefined)
        : await getStoredSeries(item.localDataId, item.dsName, body.range, body.consolidation, Number(body.step) || undefined);
      return {id:item.id, localDataId:item.localDataId, dsName:item.dsName,
        points:points.map((point) => ({x:point.timestamp * 1000, y:point.value == null ? null : point.value * multiplier}))};
    }));
    return NextResponse.json({source, range:body.range || "24h", consolidation:body.consolidation || "AVERAGE", step:Number(body.step) || 0, series});
  } catch (error) {
    console.error("Cacti RRD series:", error);
    return NextResponse.json({error:"No se pudieron consultar las series de Cacti"}, {status:502});
  }
}
