import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { dbReady, mapgenPool } from "../db";

export interface MapRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  days: Record<string, unknown>;
}

export interface MapSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  dates: string[];
}

export function validId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

export function validDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function validSnapshot(snapshot: unknown): snapshot is { nodes: unknown[]; links: unknown[] } {
  if (!snapshot || typeof snapshot !== "object") return false;
  const value = snapshot as { nodes?: unknown; links?: unknown };
  return Array.isArray(value.nodes) && Array.isArray(value.links);
}

function parseDays(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toRecord(row: RowDataPacket): MapRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    days: parseDays(row.days),
  };
}

export async function listMaps(): Promise<MapSummary[]> {
  await dbReady();
  const [rows] = await mapgenPool().query<RowDataPacket[]>(
    `SELECT id, name, created_at, updated_at, JSON_KEYS(days) AS dates FROM maps ORDER BY updated_at DESC`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    dates: (Array.isArray(row.dates) ? row.dates.map(String) : (JSON.parse(String(row.dates || "[]")) as string[])).sort(),
  }));
}

export async function readRecord(id: string): Promise<MapRecord | null> {
  await dbReady();
  const [rows] = await mapgenPool().query<RowDataPacket[]>(
    `SELECT id, name, days, created_at, updated_at FROM maps WHERE id = ?`, [id],
  );
  return rows.length ? toRecord(rows[0]) : null;
}

export async function saveDay(input: {
  id?: string; name?: string; date: string; snapshot: Record<string, unknown>; userId: number | null;
}): Promise<MapSummary> {
  await dbReady();
  const id = validId(input.id) ? input.id : randomUUID();
  // Serialize saves per map so concurrent writes can't lose a day.
  return withMapLock(id, async () => {
    const existing = await readRecord(id);
    const name = String(input.name || existing?.name || "Mapa sin nombre").trim().slice(0, 80) || "Mapa sin nombre";
    const days = existing?.days || {};
    days[input.date] = input.snapshot;
    await mapgenPool().query(
      `INSERT INTO maps (id, name, days, updated_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), days = VALUES(days), updated_by = VALUES(updated_by)`,
      [id, name, JSON.stringify(days), input.userId],
    );
    const saved = await readRecord(id);
    return {
      id, name,
      createdAt: saved?.createdAt || new Date().toISOString(),
      updatedAt: saved?.updatedAt || new Date().toISOString(),
      dates: Object.keys(days).sort(),
    };
  });
}

// Per-id serialization: two concurrent saves of the same map otherwise
// interleave their read-modify-write and one day silently overwrites the
// other. Each task chains after the previous one settles; the stored tail
// never rejects so the chain keeps flowing even if a task throws.
const tail = new Map<string, Promise<unknown>>();

export function withMapLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const run = (tail.get(id) ?? Promise.resolve()).then(task, task);
  tail.set(id, run.then(() => {}, () => {}));
  return run;
}
