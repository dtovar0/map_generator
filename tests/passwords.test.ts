import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../lib/auth/passwords";

test("hash and verify round-trip", async () => {
  const stored = await hashPassword("s3creta!");
  assert.match(stored, /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(await verifyPassword("s3creta!", stored), true);
});

test("wrong password fails", async () => {
  const stored = await hashPassword("s3creta!");
  assert.equal(await verifyPassword("otra", stored), false);
});

test("two hashes of the same password differ (random salt)", async () => {
  assert.notEqual(await hashPassword("x"), await hashPassword("x"));
});

test("malformed stored value fails safely", async () => {
  assert.equal(await verifyPassword("x", "plaintext"), false);
  assert.equal(await verifyPassword("x", "scrypt$bad"), false);
  assert.equal(await verifyPassword("x", ""), false);
});
