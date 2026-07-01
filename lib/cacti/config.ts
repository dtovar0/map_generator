import path from "node:path";

export interface CactiConfig {
  enabled: boolean;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    socketPath?: string;
  };
  rrdRoots: string[];
  rrdTool: string;
  cacheSeconds: number;
}

function list(value: string | undefined): string[] {
  return (value || "/var/lib/cacti/rra")
    .split(path.delimiter)
    .map((entry) => path.resolve(entry.trim()))
    .filter(Boolean);
}

export function getCactiConfig(): CactiConfig {
  const socketPath = process.env.CACTI_DB_SOCKET?.trim();
  return {
    enabled: process.env.CACTI_ENABLED !== "false",
    db: {
      host: process.env.CACTI_DB_HOST || "127.0.0.1",
      port: Number(process.env.CACTI_DB_PORT) || 3306,
      user: process.env.CACTI_DB_USER || "cacti_map_reader",
      password: process.env.CACTI_DB_PASSWORD || "",
      database: process.env.CACTI_DB_NAME || "cacti",
      ...(socketPath ? { socketPath } : {}),
    },
    rrdRoots: list(process.env.CACTI_RRD_ROOTS),
    rrdTool: process.env.CACTI_RRDTOOL || "/usr/bin/rrdtool",
    cacheSeconds: Math.max(5, Number(process.env.CACTI_CACHE_SECONDS) || 30),
  };
}
