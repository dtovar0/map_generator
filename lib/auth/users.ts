import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { dbReady, mapgenPool } from "../db";
import { getAuthConfig } from "./config";
import { hashPassword } from "./passwords";
import { roleFromGroups, type Role } from "./roles";

export interface AppUser {
  id: number;
  username: string;
  displayName: string | null;
  email: string | null;
  role: Role;
  provider: "local" | "authelia";
  roleLocked: boolean;
  active: boolean;
  lastLoginAt: string | null;
}

const FIELDS = `id, username, display_name, email, role, provider, role_locked, active, last_login_at, password_hash`;

function toUser(row: RowDataPacket): AppUser & { passwordHash: string | null } {
  return {
    id: Number(row.id),
    username: String(row.username),
    displayName: row.display_name == null ? null : String(row.display_name),
    email: row.email == null ? null : String(row.email),
    role: String(row.role) as Role,
    provider: String(row.provider) as "local" | "authelia",
    roleLocked: Boolean(Number(row.role_locked)),
    active: Boolean(Number(row.active)),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string).toISOString() : null,
    passwordHash: row.password_hash == null ? null : String(row.password_hash),
  };
}

function publicUser(row: RowDataPacket): AppUser {
  const { passwordHash: _omitted, ...user } = toUser(row);
  return user;
}

let bootstrapped: Promise<void> | undefined;

// Creates the first local admin from env once there is no active admin.
export function ensureAuthReady(): Promise<void> {
  bootstrapped ||= (async () => {
    await dbReady();
    const { bootstrapUser, bootstrapPassword } = getAuthConfig();
    if (!bootstrapUser || !bootstrapPassword) return;
    if ((await countActiveAdmins()) > 0) return;
    await mapgenPool().query(
      `INSERT INTO users (username, password_hash, provider, role, role_locked, active)
       VALUES (?, ?, 'local', 'admin', 1, 1)
       ON DUPLICATE KEY UPDATE role = 'admin', active = 1`,
      [bootstrapUser, await hashPassword(bootstrapPassword)],
    );
  })();
  return bootstrapped;
}

export async function getUserById(id: number): Promise<AppUser | null> {
  await ensureAuthReady();
  const [rows] = await mapgenPool().query<RowDataPacket[]>(`SELECT ${FIELDS} FROM users WHERE id = ?`, [id]);
  return rows.length ? publicUser(rows[0]) : null;
}

export async function getLocalUserForLogin(username: string): Promise<(AppUser & { passwordHash: string | null }) | null> {
  await ensureAuthReady();
  const [rows] = await mapgenPool().query<RowDataPacket[]>(`SELECT ${FIELDS} FROM users WHERE username = ?`, [username]);
  return rows.length ? toUser(rows[0]) : null;
}

export async function listUsers(): Promise<AppUser[]> {
  await ensureAuthReady();
  const [rows] = await mapgenPool().query<RowDataPacket[]>(`SELECT ${FIELDS} FROM users ORDER BY username`);
  return rows.map(publicUser);
}

export async function createLocalUser(input: {
  username: string; password: string; displayName?: string; email?: string; role: Role;
}): Promise<AppUser> {
  await ensureAuthReady();
  try {
    const [result] = await mapgenPool().query<ResultSetHeader>(
      `INSERT INTO users (username, display_name, email, password_hash, provider, role, role_locked, active)
       VALUES (?, ?, ?, ?, 'local', ?, 1, 1)`,
      [input.username, input.displayName || null, input.email || null, await hashPassword(input.password), input.role],
    );
    return (await getUserById(result.insertId))!;
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new Error("duplicate");
    throw error;
  }
}

export async function updateUser(id: number, patch: { role?: Role; active?: boolean; displayName?: string }): Promise<void> {
  await ensureAuthReady();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.role !== undefined) { sets.push("role = ?", "role_locked = 1"); params.push(patch.role); }
  if (patch.active !== undefined) { sets.push("active = ?"); params.push(patch.active ? 1 : 0); }
  if (patch.displayName !== undefined) { sets.push("display_name = ?"); params.push(patch.displayName || null); }
  if (!sets.length) return;
  params.push(id);
  await mapgenPool().query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
  if (patch.active === false) await mapgenPool().query(`DELETE FROM sessions WHERE user_id = ?`, [id]);
}

export async function setUserPassword(id: number, password: string): Promise<void> {
  await ensureAuthReady();
  await mapgenPool().query(`UPDATE users SET password_hash = ? WHERE id = ?`, [await hashPassword(password), id]);
}

export async function deleteUser(id: number): Promise<void> {
  await ensureAuthReady();
  await mapgenPool().query(`DELETE FROM users WHERE id = ?`, [id]);
}

export async function countActiveAdmins(): Promise<number> {
  await dbReady();
  const [rows] = await mapgenPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1`,
  );
  return Number(rows[0]?.total) || 0;
}

export async function touchLastLogin(id: number): Promise<void> {
  await mapgenPool().query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [id]);
}

export async function provisionAutheliaUser(identity: {
  username: string; displayName?: string; email?: string; groups: string[];
}): Promise<AppUser | null> {
  await ensureAuthReady();
  const cfg = getAuthConfig();
  const role = roleFromGroups(identity.groups, cfg);
  await mapgenPool().query(
    `INSERT INTO users (username, display_name, email, provider, role, active)
     VALUES (?, ?, ?, 'authelia', ?, 1)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       email = VALUES(email),
       provider = 'authelia',
       role = IF(role_locked = 1, role, VALUES(role)),
       last_login_at = NOW()`,
    [identity.username, identity.displayName || null, identity.email || null, role],
  );
  const user = await getLocalUserForLogin(identity.username);
  if (!user || !user.active) return null;
  const { passwordHash: _omitted, ...publicShape } = user;
  return publicShape;
}
