import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_COOKIE, clearSessionCookieHeader, readSessionToken, sessionCookieHeader,
} from "../lib/auth/session";

test("sessionCookieHeader builds a hardened cookie", () => {
  const header = sessionCookieHeader("tok123", 3600, true);
  assert.match(header, /^mapgen_session=tok123; /);
  for (const attr of ["HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=3600", "Secure"]) {
    assert.ok(header.includes(attr), `missing ${attr}`);
  }
  assert.ok(!sessionCookieHeader("t", 60, false).includes("Secure"));
});

test("clearSessionCookieHeader expires the cookie", () => {
  assert.match(clearSessionCookieHeader(false), /Max-Age=0/);
});

test("readSessionToken parses the cookie header", () => {
  const request = new Request("http://x/", { headers: { cookie: `a=1; ${SESSION_COOKIE}=abc; b=2` } });
  assert.equal(readSessionToken(request), "abc");
  assert.equal(readSessionToken(new Request("http://x/")), null);
});
