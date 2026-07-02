import { readFile } from "node:fs/promises";
import path from "node:path";

export const mapsDirectory = path.join(process.cwd(), "data", "maps");

export interface MapRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  days: Record<string, unknown>;
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

export async function readRecord(id: string): Promise<MapRecord | null> {
  try {
    return JSON.parse(await readFile(path.join(mapsDirectory, `${id}.json`), "utf8")) as MapRecord;
  } catch {
    return null;
  }
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
