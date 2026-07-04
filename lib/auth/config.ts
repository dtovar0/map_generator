import { isRole, type Role } from "./roles";

export interface AuthConfig {
  localEnabled: boolean;
  forwardEnabled: boolean;
  oidcEnabled: boolean;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  sessionSecret: string;
  sessionTtlHours: number;
  adminGroups: string[];
  editorGroups: string[];
  defaultRole: Role;
  bootstrapUser: string;
  bootstrapPassword: string;
}

function csv(value: string | undefined): string[] {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function getAuthConfig(): AuthConfig {
  const defaultRole = process.env.AUTH_DEFAULT_ROLE?.trim().toLowerCase();
  return {
    localEnabled: process.env.AUTH_LOCAL_ENABLED !== "false",
    forwardEnabled: process.env.AUTH_FORWARD_ENABLED === "true",
    oidcEnabled: process.env.AUTH_OIDC_ENABLED === "true",
    oidcIssuer: (process.env.AUTH_OIDC_ISSUER || "").replace(/\/$/, ""),
    oidcClientId: process.env.AUTH_OIDC_CLIENT_ID || "",
    oidcClientSecret: process.env.AUTH_OIDC_CLIENT_SECRET || "",
    sessionSecret: process.env.AUTH_SESSION_SECRET || "",
    sessionTtlHours: Math.max(1, Number(process.env.AUTH_SESSION_TTL_HOURS) || 168),
    adminGroups: csv(process.env.AUTH_ADMIN_GROUPS),
    editorGroups: csv(process.env.AUTH_EDITOR_GROUPS),
    defaultRole: isRole(defaultRole) ? defaultRole : "viewer",
    bootstrapUser: process.env.AUTH_BOOTSTRAP_ADMIN_USER?.trim() || "",
    bootstrapPassword: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || "",
  };
}
