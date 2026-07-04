import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";
import { getAuthConfig } from "./config";

export const OIDC_STATE_COOKIE = "mapgen_oidc";

// Behind the TLS proxy request.url is plain http; rebuild the public origin
// from the forwarded proto so OIDC redirect URIs match the registered client.
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || url.host;
  return `${proto || url.protocol.replace(":", "")}://${host}`;
}

export interface OidcMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signStatePayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

export function verifyStatePayload(value: string, secret: string): Record<string, unknown> | null {
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(hmac(body, secret));
  const provided = Buffer.from(mac);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyIdToken(
  idToken: string,
  options: { issuer: string; audience: string; jwks: { keys: JsonWebKey[] } },
): Record<string, unknown> | null {
  try {
    const [headPart, bodyPart, signaturePart] = idToken.split(".");
    if (!headPart || !bodyPart || !signaturePart) return null;
    const header = JSON.parse(Buffer.from(headPart, "base64url").toString("utf8")) as { alg?: string; kid?: string };
    if (header.alg !== "RS256") return null;
    const candidates = options.jwks.keys.filter((key) =>
      !header.kid || (key as { kid?: string }).kid === header.kid);
    const data = Buffer.from(`${headPart}.${bodyPart}`);
    const signature = Buffer.from(signaturePart, "base64url");
    const valid = candidates.some((key) => {
      try {
        return cryptoVerify("RSA-SHA256", data, createPublicKey({ key, format: "jwk" }), signature);
      } catch {
        return false;
      }
    });
    if (!valid) return null;
    const claims = JSON.parse(Buffer.from(bodyPart, "base64url").toString("utf8")) as Record<string, unknown>;
    if (claims.iss !== options.issuer) return null;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(options.audience)) return null;
    if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

let metadataCache: { value: OidcMetadata; until: number } | undefined;
let jwksCache: { value: { keys: JsonWebKey[] }; until: number } | undefined;
const DISCOVERY_TTL_MS = 10 * 60_000;

export async function getOidcMetadata(): Promise<OidcMetadata | null> {
  if (metadataCache && metadataCache.until > Date.now()) return metadataCache.value;
  const { oidcIssuer } = getAuthConfig();
  if (!oidcIssuer) return null;
  try {
    const response = await fetch(`${oidcIssuer}/.well-known/openid-configuration`, { cache: "no-store" });
    if (!response.ok) return null;
    const value = await response.json() as OidcMetadata;
    if (!value.authorization_endpoint || !value.token_endpoint || !value.jwks_uri) return null;
    metadataCache = { value, until: Date.now() + DISCOVERY_TTL_MS };
    return value;
  } catch (error) {
    console.error("OIDC discovery:", error);
    return null;
  }
}

export async function getJwks(jwksUri: string): Promise<{ keys: JsonWebKey[] } | null> {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.value;
  try {
    const response = await fetch(jwksUri, { cache: "no-store" });
    if (!response.ok) return null;
    const value = await response.json() as { keys: JsonWebKey[] };
    if (!Array.isArray(value.keys)) return null;
    jwksCache = { value, until: Date.now() + DISCOVERY_TTL_MS };
    return value;
  } catch (error) {
    console.error("OIDC jwks:", error);
    return null;
  }
}
