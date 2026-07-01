import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mapsDirectory = path.join(process.cwd(), "data", "maps");

interface MapRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  days: Record<string, unknown>;
}

function validId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

function validDate(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function validSnapshot(snapshot: unknown): snapshot is { nodes: unknown[]; links: unknown[] } {
  if (!snapshot || typeof snapshot !== "object") return false;
  const value = snapshot as { nodes?: unknown; links?: unknown };
  return Array.isArray(value.nodes) && Array.isArray(value.links);
}

async function readRecord(id: string): Promise<MapRecord | null> {
  try {
    return JSON.parse(await readFile(path.join(mapsDirectory, `${id}.json`), "utf8")) as MapRecord;
  } catch {
    return null;
  }
}

export async function GET() {
  await mkdir(mapsDirectory, { recursive: true });
  const files = (await readdir(mapsDirectory)).filter((file) => file.endsWith(".json"));
  const records = await Promise.all(files.map(async (file) => {
    try {
      return JSON.parse(await readFile(path.join(mapsDirectory, file), "utf8")) as MapRecord;
    } catch {
      return null;
    }
  }));
  const maps = records.filter((record): record is MapRecord => Boolean(record)).map((record) => ({
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    dates: Object.keys(record.days || {}).sort(),
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return NextResponse.json({ maps });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !validDate(body.date) || !validSnapshot(body.snapshot)) {
    return NextResponse.json({ error: "Datos de mapa inválidos" }, { status: 400 });
  }

  await mkdir(mapsDirectory, { recursive: true });
  const id = validId(body.id) ? body.id : randomUUID();
  const now = new Date().toISOString();
  const existing = await readRecord(id);
  const name = String(body.name || existing?.name || "Mapa sin nombre").trim().slice(0, 80) || "Mapa sin nombre";
  const record: MapRecord = existing || { id, name, createdAt: now, updatedAt: now, days: {} };
  record.name = name;
  record.updatedAt = now;
  record.days ||= {};
  record.days[body.date] = body.snapshot;

  const destination = path.join(mapsDirectory, `${id}.json`);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(record, null, 2), "utf8");
  await rename(temporary, destination);

  return NextResponse.json({
    map: { id, name, createdAt: record.createdAt, updatedAt: now, dates: Object.keys(record.days).sort() },
  });
}
