import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getDataSourcePaths, type StoredMetric } from "./catalog";
import { getCactiConfig } from "./config";

const execFileAsync = promisify(execFile);

async function resolveRrdPath(storedPath: string): Promise<string> {
  const { rrdRoots } = getCactiConfig();
  if (!rrdRoots.length) throw new Error("CACTI_RRD_PATH no contiene rutas válidas");
  const roots = await Promise.all(rrdRoots.map((root) => realpath(root)));
  const expanded = storedPath
    .replaceAll("<path_rra>", roots[0])
    .replaceAll("<path_cacti>", path.dirname(roots[0]));
  const filename = await realpath(path.isAbsolute(expanded) ? expanded : path.join(roots[0], expanded));
  const allowed = roots.some((root) => {
    const relative = path.relative(root, filename);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  });
  if (!allowed || path.extname(filename).toLowerCase() !== ".rrd") {
    throw new Error("Ruta RRD fuera de CACTI_RRD_PATH");
  }
  return filename;
}

function dateRange(date?: string): [string, string] {
  if (!date) return ["now-20m", "now"];
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [String(Math.floor(start.getTime() / 1000)), String(Math.floor(end.getTime() / 1000))];
}

async function fetchRrd(localDataId: number, filename: string, date?: string): Promise<StoredMetric[]> {
  const { rrdTool } = getCactiConfig();
  const [start, end] = dateRange(date);
  const { stdout } = await execFileAsync(rrdTool, ["fetch", filename, "AVERAGE", "--start", start, "--end", end], {
    timeout: 15_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const names = lines[0].split(/\s+/);
  const samples = new Map<string, Array<{ timestamp: number; value: number }>>();
  names.forEach((name) => samples.set(name, []));
  for (const line of lines.slice(1)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const timestamp = Number(line.slice(0, separator));
    const values = line.slice(separator + 1).trim().split(/\s+/);
    names.forEach((name, index) => {
      const value = Number(values[index]);
      if (Number.isFinite(timestamp) && Number.isFinite(value)) samples.get(name)?.push({ timestamp, value });
    });
  }
  return names.flatMap((dsName) => {
    const values = samples.get(dsName) || [];
    if (!values.length) return [];
    const latest = values[values.length - 1];
    const valueRaw = date ? values.reduce((sum, item) => sum + item.value, 0) / values.length : latest.value;
    return [{ localDataId, dsName, timestamp: latest.timestamp, valueRaw }];
  });
}

export async function getRrdMetrics(localDataIds: number[], date?: string): Promise<StoredMetric[]> {
  const paths = await getDataSourcePaths(localDataIds);
  const entries = [...paths];
  const metrics: StoredMetric[][] = [];
  for (let index = 0; index < entries.length; index += 8) {
    const batch = entries.slice(index, index + 8);
    metrics.push(...await Promise.all(batch.map(async ([localDataId, storedPath]) => {
      if (!storedPath) return [];
      return fetchRrd(localDataId, await resolveRrdPath(storedPath), date);
    })));
  }
  return metrics.flat();
}
