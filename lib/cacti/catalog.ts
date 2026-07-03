import mysql, { type RowDataPacket } from "mysql2/promise";
import { getCactiConfig } from "./config";

export interface CactiDevice {
  id: number;
  name: string;
  hostname: string;
  disabled: boolean;
}

export interface CactiDataSource {
  localDataId: number;
  hostId: number;
  name: string;
  snmpIndex: string;
  rrdPath: string;
  dataSourceNames: string[];
  capacityBps: number | null;
}

const capacitySql = `(SELECT MAX(CASE
    WHEN hsc.field_name = 'ifHighSpeed' AND CAST(hsc.field_value AS UNSIGNED) > 0
      THEN CAST(hsc.field_value AS UNSIGNED) * 1000000
    WHEN hsc.field_name = 'ifSpeed' AND CAST(hsc.field_value AS UNSIGNED) > 0
      THEN CAST(hsc.field_value AS UNSIGNED)
  END)
  FROM host_snmp_cache hsc
  WHERE hsc.host_id = dl.host_id AND hsc.snmp_index = dl.snmp_index
    AND hsc.field_name IN ('ifHighSpeed', 'ifSpeed'))`;

export interface CactiGraph {
  id: number;
  hostId: number;
  name: string;
  dataSources: CactiDataSource[];
}

let pool: mysql.Pool | undefined;

export function cactiPool(): mysql.Pool {
  if (!pool) {
    const { db } = getCactiConfig();
    pool = mysql.createPool({ ...db, waitForConnections: true, connectionLimit: 5, maxIdle: 2 });
  }
  return pool;
}

export async function listDevices(search = ""): Promise<CactiDevice[]> {
  const term = `%${search.slice(0, 100)}%`;
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT id, description, hostname, disabled
       FROM host
      WHERE (? = '%%' OR description LIKE ? OR hostname LIKE ?)
      ORDER BY description, hostname LIMIT 500`,
    [term, term, term],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.description || row.hostname || `Host ${row.id}`),
    hostname: String(row.hostname || ""),
    disabled: String(row.disabled || "").toLowerCase() === "on",
  }));
}

export async function listDataSources(hostId: number, search = ""): Promise<CactiDataSource[]> {
  const term = `%${search.slice(0, 100)}%`;
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT dl.id AS local_data_id, dl.host_id, dl.snmp_index,
            COALESCE(NULLIF(dtd.name, ''), CONCAT('Data source ', dl.id)) AS data_name,
            dtd.data_source_path, ${capacitySql} AS capacity_bps,
            GROUP_CONCAT(DISTINCT pi.rrd_name ORDER BY pi.rrd_name SEPARATOR ',') AS rrd_names
       FROM data_local dl
       JOIN data_template_data dtd ON dtd.local_data_id = dl.id
       LEFT JOIN poller_item pi ON pi.local_data_id = dl.id
      WHERE dl.host_id = ?
        AND (? = '%%' OR dtd.name LIKE ? OR dl.snmp_index LIKE ? OR pi.rrd_name LIKE ?)
      GROUP BY dl.id, dl.host_id, dl.snmp_index, dtd.name, dtd.data_source_path
      ORDER BY dtd.name, dl.id LIMIT 1000`,
    [hostId, term, term, term, term],
  );
  return rows.map((row) => ({
    localDataId: Number(row.local_data_id),
    hostId: Number(row.host_id),
    name: String(row.data_name),
    snmpIndex: String(row.snmp_index || ""),
    rrdPath: String(row.data_source_path || ""),
    dataSourceNames: String(row.rrd_names || "").split(",").filter(Boolean),
    capacityBps: Number(row.capacity_bps) > 0 ? Number(row.capacity_bps) : null,
  }));
}

export async function listGraphs(hostId: number, search = ""): Promise<CactiGraph[]> {
  const term = `%${search.slice(0, 100)}%`;
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT gl.id AS local_graph_id, gl.host_id,
            COALESCE(NULLIF(gtg.title_cache, ''), CONCAT('Graph ', gl.id)) AS graph_name,
            dl.id AS local_data_id, dl.snmp_index,
            COALESCE(NULLIF(dtd.name, ''), CONCAT('Data source ', dl.id)) AS data_name,
            dtd.data_source_path, dtr.data_source_name, ${capacitySql} AS capacity_bps
       FROM graph_local gl
       JOIN graph_templates_graph gtg ON gtg.local_graph_id = gl.id
       JOIN graph_templates_item gti ON gti.local_graph_id = gl.id AND gti.task_item_id > 0
       JOIN data_template_rrd dtr ON dtr.id = gti.task_item_id
       JOIN data_local dl ON dl.id = dtr.local_data_id
       JOIN data_template_data dtd ON dtd.local_data_id = dl.id
      WHERE gl.host_id = ? AND (? = '%%' OR gtg.title_cache LIKE ?)
      ORDER BY gtg.title_cache, gl.id, dtr.data_source_name LIMIT 3000`,
    [hostId, term, term],
  );
  const graphs = new Map<number, CactiGraph>();
  for (const row of rows) {
    const graphId = Number(row.local_graph_id);
    let graph = graphs.get(graphId);
    if (!graph) {
      graph = { id:graphId, hostId:Number(row.host_id), name:String(row.graph_name), dataSources:[] };
      graphs.set(graphId, graph);
    }
    const localDataId = Number(row.local_data_id);
    let source = graph.dataSources.find((item) => item.localDataId === localDataId);
    if (!source) {
      source = { localDataId, hostId:Number(row.host_id), name:String(row.data_name),
        snmpIndex:String(row.snmp_index || ""), rrdPath:String(row.data_source_path || ""), dataSourceNames:[],
        capacityBps:Number(row.capacity_bps) > 0 ? Number(row.capacity_bps) : null };
      graph.dataSources.push(source);
    }
    const dsName = String(row.data_source_name || "");
    if (dsName && !source.dataSourceNames.includes(dsName)) source.dataSourceNames.push(dsName);
  }
  return [...graphs.values()];
}

export async function getDataSource(localDataId: number): Promise<CactiDataSource | null> {
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT dl.id AS local_data_id, dl.host_id, dl.snmp_index,
            COALESCE(NULLIF(dtd.name, ''), CONCAT('Data source ', dl.id)) AS data_name,
            dtd.data_source_path, ${capacitySql} AS capacity_bps,
            GROUP_CONCAT(DISTINCT pi.rrd_name ORDER BY pi.rrd_name SEPARATOR ',') AS rrd_names
       FROM data_local dl
       JOIN data_template_data dtd ON dtd.local_data_id = dl.id
       LEFT JOIN poller_item pi ON pi.local_data_id = dl.id
      WHERE dl.id = ?
      GROUP BY dl.id, dl.host_id, dl.snmp_index, dtd.name, dtd.data_source_path LIMIT 1`,
    [localDataId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    localDataId: Number(row.local_data_id), hostId: Number(row.host_id),
    name: String(row.data_name), snmpIndex: String(row.snmp_index || ""),
    rrdPath: String(row.data_source_path || ""),
    dataSourceNames: String(row.rrd_names || "").split(",").filter(Boolean),
    capacityBps: Number(row.capacity_bps) > 0 ? Number(row.capacity_bps) : null,
  };
}

export interface StoredMetric {
  localDataId: number;
  dsName: string;
  timestamp: number;
  valueRaw: number | null;
}

export interface StoredSeriesPoint { timestamp: number; value: number | null }

const SERIES_WINDOWS: Record<string, {seconds:number; bucket:number}> = {
  "1h":{seconds:3600,bucket:60}, "6h":{seconds:21600,bucket:300},
  "24h":{seconds:86400,bucket:900}, "7d":{seconds:604800,bucket:3600},
  "30d":{seconds:2592000,bucket:14400}, "90d":{seconds:7776000,bucket:43200},
  "1y":{seconds:31536000,bucket:86400},
};

/** Returns a downsampled historical series from the collector table. */
export async function getStoredSeries(
  localDataId: number,
  dsName: string,
  range = "24h",
  consolidation: "AVERAGE" | "MIN" | "MAX" | "LAST" = "AVERAGE",
  requestedStep?: number,
): Promise<StoredSeriesPoint[]> {
  const window = SERIES_WINDOWS[range] || SERIES_WINDOWS["24h"];
  const bucket = requestedStep && Number.isInteger(requestedStep) && requestedStep > 0 ? requestedStep : window.bucket;
  const aggregate = consolidation === "MIN" ? "MIN(value_raw)" : consolidation === "MAX" ? "MAX(value_raw)" :
    consolidation === "LAST" ? "CAST(SUBSTRING_INDEX(GROUP_CONCAT(value_raw ORDER BY sample_time DESC), ',', 1) AS DOUBLE)" : "AVG(value_raw)";
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT FLOOR(UNIX_TIMESTAMP(sample_time) / ?) * ? AS bucket_timestamp, ${aggregate} AS bucket_value
       FROM mapgen_rrd_samples
      WHERE local_data_id = ? AND ds_name = ? AND sample_time >= FROM_UNIXTIME(UNIX_TIMESTAMP() - ?)
      GROUP BY bucket_timestamp ORDER BY bucket_timestamp`,
    [bucket, bucket, localDataId, dsName, window.seconds],
  );
  return rows.map((row) => ({timestamp:Number(row.bucket_timestamp), value:row.bucket_value == null ? null : Number(row.bucket_value)}));
}

export async function getDataSourcePaths(localDataIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(localDataIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT dl.id AS local_data_id, dtd.data_source_path
       FROM data_local dl
       JOIN data_template_data dtd ON dtd.local_data_id = dl.id
      WHERE dl.id IN (${placeholders})`,
    ids,
  );
  return new Map(rows.map((row) => [Number(row.local_data_id), String(row.data_source_path || "")]));
}

export async function getStoredMetrics(localDataIds: number[], date?: string): Promise<StoredMetric[]> {
  const ids = [...new Set(localDataIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  if (date) {
    const [rows] = await cactiPool().query<RowDataPacket[]>(
      `SELECT local_data_id, ds_name, UNIX_TIMESTAMP(MAX(sample_time)) AS sample_timestamp,
              AVG(value_raw) AS value_raw
         FROM mapgen_rrd_samples
        WHERE local_data_id IN (${placeholders}) AND sample_time >= ? AND sample_time < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY local_data_id, ds_name`,
      [...ids, date, date],
    );
    return rows.map((row) => ({ localDataId:Number(row.local_data_id), dsName:String(row.ds_name),
      timestamp:Number(row.sample_timestamp), valueRaw:row.value_raw == null ? null : Number(row.value_raw) }));
  }
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT local_data_id, ds_name, UNIX_TIMESTAMP(sample_time) AS sample_timestamp, value_raw
       FROM mapgen_rrd_samples
      WHERE local_data_id IN (${placeholders}) AND sample_time >= NOW() - INTERVAL 30 MINUTE
      ORDER BY sample_time DESC`,
    ids,
  );
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.local_data_id}:${row.ds_name}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map((row) => ({ localDataId:Number(row.local_data_id), dsName:String(row.ds_name),
    timestamp:Number(row.sample_timestamp), valueRaw:row.value_raw == null ? null : Number(row.value_raw) }));
}
