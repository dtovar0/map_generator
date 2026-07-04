export interface MapgenDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  socketPath?: string;
}

export function getMapgenDbConfig(): MapgenDbConfig {
  const socketPath = process.env.MAPGEN_DB_SOCKET?.trim();
  return {
    host: process.env.MAPGEN_DB_HOST || "127.0.0.1",
    port: Number(process.env.MAPGEN_DB_PORT) || 3306,
    user: process.env.MAPGEN_DB_USER || "mapgen",
    password: process.env.MAPGEN_DB_PASSWORD || "",
    database: process.env.MAPGEN_DB_NAME || "mapgen",
    ...(socketPath ? { socketPath } : {}),
  };
}
