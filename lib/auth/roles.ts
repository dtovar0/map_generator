export type Role = "admin" | "editor" | "viewer";

const ORDER: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export function isRole(value: unknown): value is Role {
  return value === "admin" || value === "editor" || value === "viewer";
}

export function hasRole(role: Role, minimum: Role): boolean {
  return ORDER[role] >= ORDER[minimum];
}

export function roleFromGroups(
  groups: string[],
  cfg: { adminGroups: string[]; editorGroups: string[]; defaultRole: Role },
): Role {
  const set = new Set(groups.map((g) => g.trim().toLowerCase()).filter(Boolean));
  if (cfg.adminGroups.some((g) => set.has(g.toLowerCase()))) return "admin";
  if (cfg.editorGroups.some((g) => set.has(g.toLowerCase()))) return "editor";
  return cfg.defaultRole;
}
