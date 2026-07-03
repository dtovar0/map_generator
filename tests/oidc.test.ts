import assert from "node:assert/strict";
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { signStatePayload, verifyIdToken, verifyStatePayload } from "../lib/auth/oidc";

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function makeIdToken(claims: Record<string, unknown>, privateKeyPem: string, kid = "k1"): string {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const body = b64url(JSON.stringify(claims));
  const signature = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), createPrivateKey(privateKeyPem));
  return `${head}.${body}.${signature.toString("base64url")}`;
}

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
const jwk = { ...(publicKey.export({ format: "jwk" }) as JsonWebKey), kid: "k1" };
const jwks = { keys: [jwk] };
const now = Math.floor(Date.now() / 1000);
const base = { iss: "https://auth.example.com", aud: "mapgen", exp: now + 300, preferred_username: "ana" };

test("valid RS256 id_token verifies and returns claims", () => {
  const claims = verifyIdToken(makeIdToken(base, privatePem), { issuer: base.iss, audience: "mapgen", jwks });
  assert.equal(claims?.preferred_username, "ana");
});

test("wrong issuer, audience, expiry or signature are rejected", () => {
  const opts = { issuer: base.iss, audience: "mapgen", jwks };
  assert.equal(verifyIdToken(makeIdToken({ ...base, iss: "https://evil" }, privatePem), opts), null);
  assert.equal(verifyIdToken(makeIdToken({ ...base, aud: "otro" }, privatePem), opts), null);
  assert.equal(verifyIdToken(makeIdToken({ ...base, exp: now - 10 }, privatePem), opts), null);
  const tampered = makeIdToken(base, privatePem).slice(0, -6) + "AAAAAA";
  assert.equal(verifyIdToken(tampered, opts), null);
});

test("state cookie round-trip and tamper detection", () => {
  const value = signStatePayload({ state: "s1", verifier: "v1", exp: now + 600 }, "secreto");
  assert.equal((verifyStatePayload(value, "secreto") as { state: string }).state, "s1");
  assert.equal(verifyStatePayload(value, "otro-secreto"), null);
  assert.equal(verifyStatePayload(value + "x", "secreto"), null);
  const expired = signStatePayload({ state: "s1", exp: now - 5 }, "secreto");
  assert.equal(verifyStatePayload(expired, "secreto"), null);
});
