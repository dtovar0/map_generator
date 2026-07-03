import assert from "node:assert/strict";
import { test } from "node:test";
import { hasRole, isRole, roleFromGroups } from "../lib/auth/roles";

const cfg = { adminGroups: ["mapgen-admins"], editorGroups: ["mapgen-editors", "noc"], defaultRole: "viewer" as const };

test("admin group wins over editor group", () => {
  assert.equal(roleFromGroups(["noc", "mapgen-admins"], cfg), "admin");
});

test("editor group maps to editor, case/space-insensitive", () => {
  assert.equal(roleFromGroups(["  NOC  "], cfg), "editor");
});

test("no match falls back to default role", () => {
  assert.equal(roleFromGroups(["otros"], cfg), "viewer");
  assert.equal(roleFromGroups([], cfg), "viewer");
});

test("hasRole respects hierarchy", () => {
  assert.equal(hasRole("admin", "editor"), true);
  assert.equal(hasRole("viewer", "editor"), false);
  assert.equal(hasRole("editor", "editor"), true);
});

test("isRole validates", () => {
  assert.equal(isRole("admin"), true);
  assert.equal(isRole("root"), false);
});
