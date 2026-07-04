// One-shot import of data/maps/*.json into the mapgen.maps table.
// Usage: MAPGEN_DB_PASSWORD=... npm run maps:import
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const directory = path.join(process.cwd(), "data", "maps");
const socketPath = process.env.MAPGEN_DB_SOCKET?.trim();
const connection = await mysql.createConnection({
  host: process.env.MAPGEN_DB_HOST || "127.0.0.1",
  port: Number(process.env.MAPGEN_DB_PORT) || 3306,
  user: process.env.MAPGEN_DB_USER || "mapgen",
  password: process.env.MAPGEN_DB_PASSWORD || "",
  database: process.env.MAPGEN_DB_NAME || "mapgen",
  ...(socketPath ? { socketPath } : {}),
});

let files = [];
try {
  files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
} catch {
  console.log(`No existe ${directory}; nada que importar.`);
  process.exit(0);
}

let imported = 0, skipped = 0, failed = 0;
for (const file of files) {
  try {
    const record = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    if (!record?.id || !record?.days) { failed += 1; continue; }
    const [result] = await connection.query(
      `INSERT IGNORE INTO maps (id, name, days, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [record.id, record.name || "Mapa sin nombre", JSON.stringify(record.days),
       new Date(record.createdAt || Date.now()), new Date(record.updatedAt || Date.now())],
    );
    if (result.affectedRows) imported += 1; else skipped += 1;
  } catch (error) {
    failed += 1;
    console.error(`Error importando ${file}:`, error.message);
  }
}
console.log(`Importados: ${imported}, ya existían: ${skipped}, con error: ${failed}. Los JSON quedan como respaldo.`);
await connection.end();
