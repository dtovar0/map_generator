import { NextResponse } from "next/server";
import { cactiPool } from "../../../../lib/cacti/catalog";
import { getCactiConfig } from "../../../../lib/cacti/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getCactiConfig();
  const result = {
    enabled: config.enabled,
    metricsSource: config.metricsSource,
    database: { ok: false, host: config.db.socketPath || config.db.host, name: config.db.database, error: "" },
    collector: { ok: false, lastSample: null as string | null, error: "" },
  };
  if (!config.enabled) return NextResponse.json(result);
  try {
    await cactiPool().query("SELECT 1");
    result.database.ok = true;
    if (config.metricsSource === "rrd") {
      result.collector.ok = true;
      return NextResponse.json(result);
    }
    const [rows] = await cactiPool().query<Array<{ last_sample: Date | null } & import("mysql2").RowDataPacket>>(
      "SELECT MAX(sample_time) AS last_sample FROM mapgen_rrd_samples",
    );
    result.collector.ok = true;
    result.collector.lastSample = rows[0]?.last_sample ? new Date(rows[0].last_sample).toISOString() : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible conectar";
    if (!result.database.ok) result.database.error = message;
    else result.collector.error = message;
  }
  return NextResponse.json(result, { status: result.database.ok && result.collector.ok ? 200 : 503 });
}
