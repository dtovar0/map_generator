import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../lib/auth/passwords";

// Regression guard for the login timing-equalizer: the hardcoded dummy
// constant must never authenticate against a real user's stored hash, and the
// login route must never treat the dummy verification as a successful login
// (the route discards its boolean result — see app/api/auth/login/route.ts).
test("the timing-equalizer dummy password never matches a real user hash", async () => {
  const realUserHash = await hashPassword("la-contrasena-real-del-usuario");
  assert.equal(await verifyPassword("timing-equalizer-dummy", realUserHash), false);
});

test("the dummy password only verifies against its own dummy hash", async () => {
  const dummyHash = await hashPassword("timing-equalizer-dummy");
  // It verifies against its own hash (that's what makes it a timing equalizer),
  // which is exactly why the login route must discard this result rather than
  // use it as the auth decision for passwordless (Authelia) accounts.
  assert.equal(await verifyPassword("timing-equalizer-dummy", dummyHash), true);
  assert.equal(await verifyPassword("otra-cosa", dummyHash), false);
});
