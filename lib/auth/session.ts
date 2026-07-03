import { createHash, randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { mapgenPool } from "../db";
import { getAuthConfig } from "./config";
import { ensureAuthReady, getUserById, touchLastLogin, type AppUser } from "./users";

export const SESSION_COOKIE = "mapgen_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSecureRequest(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return proto === "https";
}

export function sessionCookieHeader(token: string, maxAge: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(secure: boolean): string {
  return sessionCookieHeader("", 0, secure);
}

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export async function createSession(userId: number): Promise<{ token: string; maxAge: number }> {
  await ensureAuthReady();
  const token = randomBytes(32).toString("base64url");
  const maxAge = getAuthConfig().sessionTtlHours * 3600;
  await mapgenPool().query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, FROM_UNIXTIME(UNIX_TIMESTAMP() + ?))`,
    [hashToken(token), userId, maxAge],
  );
  await touchLastLogin(userId);
  return { token, maxAge };
}

export async function getSessionUser(token: string): Promise<AppUser | null> {
  await ensureAuthReady();
  const tokenHash = hashToken(token);
  const ttlSeconds = getAuthConfig().sessionTtlHours * 3600;
  const [rows] = await mapgenPool().query<RowDataPacket[]>(
    `SELECT user_id, UNIX_TIMESTAMP(expires_at) AS expires_ts FROM sessions
      WHERE token_hash = ? AND expires_at > NOW()`,
    [tokenHash],
  );
  if (!rows.length) return null;
  const remaining = Number(rows[0].expires_ts) - Math.floor(Date.now() / 1000);
  // Sliding renewal once less than half the TTL remains; piggyback expired-row purge.
  if (remaining < ttlSeconds / 2) {
    await mapgenPool().query(
      `UPDATE sessions SET expires_at = FROM_UNIXTIME(UNIX_TIMESTAMP() + ?), last_seen_at = NOW() WHERE token_hash = ?`,
      [ttlSeconds, tokenHash],
    );
    await mapgenPool().query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  }
  const user = await getUserById(Number(rows[0].user_id));
  return user && user.active ? user : null;
}

export async function destroySession(token: string): Promise<void> {
  await ensureAuthReady();
  await mapgenPool().query(`DELETE FROM sessions WHERE token_hash = ?`, [hashToken(token)]);
}
