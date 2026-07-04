import { getAuthConfig } from "./config";
import { provisionAutheliaUser, type AppUser } from "./users";

// Trusted-header identity is stateless: Authelia headers arrive on every
// proxied request, so no session row is created. Trust model (user decision):
// the app performs no origin check — deployment MUST bind the server to
// 127.0.0.1 behind the proxy, and the proxy MUST strip client Remote-*
// headers. The provisioned user is cached briefly to avoid a DB round-trip
// per request.
const cache = new Map<string, { user: AppUser | null; until: number }>();
const CACHE_MS = 60_000;

export async function userFromForwardHeaders(request: Request): Promise<AppUser | null> {
  const cfg = getAuthConfig();
  if (!cfg.forwardEnabled) return null;
  const username = request.headers.get("remote-user")?.trim();
  if (!username) return null;
  const groups = (request.headers.get("remote-groups") || "").split(",").map((g) => g.trim()).filter(Boolean);
  const key = `${username}|${groups.join(",")}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.user;
  const user = await provisionAutheliaUser({
    username,
    displayName: request.headers.get("remote-name")?.trim() || undefined,
    email: request.headers.get("remote-email")?.trim() || undefined,
    groups,
  });
  cache.set(key, { user, until: Date.now() + CACHE_MS });
  if (cache.size > 500) cache.clear();
  return user;
}
