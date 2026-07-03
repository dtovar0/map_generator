import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const N = 16384, R = 8, P = 1, KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltEncoded, hashEncoded] = parts;
  const salt = Buffer.from(saltEncoded, "base64url");
  const expected = Buffer.from(hashEncoded, "base64url");
  if (!salt.length || !expected.length) return false;
  try {
    const actual = await scrypt(password, salt, expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
