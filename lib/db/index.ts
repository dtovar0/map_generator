import mysql from "mysql2/promise";
import { getMapgenDbConfig } from "./config";

let pool: mysql.Pool | undefined;
let ready: Promise<void> | undefined;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id            INT AUTO_INCREMENT PRIMARY KEY,
     username      VARCHAR(190) NOT NULL UNIQUE,
     display_name  VARCHAR(190) NULL,
     email         VARCHAR(190) NULL,
     password_hash VARCHAR(255) NULL,
     provider      ENUM('local','authelia') NOT NULL DEFAULT 'local',
     role          ENUM('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
     role_locked   TINYINT(1) NOT NULL DEFAULT 0,
     active        TINYINT(1) NOT NULL DEFAULT 1,
     created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     last_login_at TIMESTAMP NULL
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash   CHAR(64) PRIMARY KEY,
     user_id      INT NOT NULL,
     created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     expires_at   TIMESTAMP NOT NULL,
     last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
     INDEX idx_sessions_expires (expires_at)
   )`,
  `CREATE TABLE IF NOT EXISTS maps (
     id         VARCHAR(80) PRIMARY KEY,
     name       VARCHAR(255) NOT NULL,
     days       JSON NOT NULL,
     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     updated_by INT NULL,
     FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
   )`,
];

export function mapgenPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...getMapgenDbConfig(),
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
    });
  }
  return pool;
}

// Idempotent schema, run once per process on first use.
export function dbReady(): Promise<void> {
  ready ||= (async () => {
    for (const sql of SCHEMA) await mapgenPool().query(sql);
  })().catch((error) => {
    ready = undefined; // retry on next request after a transient DB failure
    throw error;
  });
  return ready;
}
