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
}

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
            dtd.data_source_path,
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
  }));
}

export async function listGraphs(hostId: number, search = ""): Promise<CactiGraph[]> {
  const term = `%${search.slice(0, 100)}%`;
  const [rows] = await cactiPool().query<RowDataPacket[]>(
    `SELECT gl.id AS local_graph_id, gl.host_id,
            COALESCE(NULLIF(gtg.title_cache, ''), CONCAT('Graph ', gl.id)) AS graph_name,
            dl.id AS local_data_id, dl.snmp_index,
            COALESCE(NULLIF(dtd.name, ''), CONCAT('Data source ', dl.id)) AS data_name,
            dtd.data_source_path, dtr.data_source_name
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
        snmpIndex:String(row.snmp_index || ""), rrdPath:String(row.data_source_path || ""), dataSourceNames:[] };
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
            dtd.data_source_path,
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
  };
}

export interface StoredMetric {
  localDataId: number;
  dsName: string;
  timestamp: number;
  valueRaw: number | null;
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
