import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  type MapRecord,
  mapsDirectory,
  readRecord,
  validDate,
  validId,
  validSnapshot,
  withMapLock,
} from "../../../lib/maps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const date = body.date;
  const snapshot = body.snapshot;

  // Serialize saves per map so concurrent writes can't lose a day.
  const saved = await withMapLock(id, async () => {
    const now = new Date().toISOString();
    const existing = await readRecord(id);
    const name = String(body.name || existing?.name || "Mapa sin nombre").trim().slice(0, 80) || "Mapa sin nombre";
    const record: MapRecord = existing || { id, name, createdAt: now, updatedAt: now, days: {} };
    record.name = name;
    record.updatedAt = now;
    record.days ||= {};
    record.days[date] = snapshot;

    const destination = path.join(mapsDirectory, `${id}.json`);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(record, null, 2), "utf8");
    await rename(temporary, destination);
    return { id, name, createdAt: record.createdAt, updatedAt: now, dates: Object.keys(record.days).sort() };
  });

  return NextResponse.json({ map: saved });
}
