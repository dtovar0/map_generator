import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CSP with a per-request nonce. In production script-src drops 'unsafe-inline'
// entirely: Next's inline bootstrap scripts and our theme script carry the
// nonce, the split editor runtime is same-origin so 'self' covers it, and the
// inline on*= handlers are gone (delegation). Dev keeps 'unsafe-inline' and
// 'unsafe-eval' so HMR/react-refresh keep working.
export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = btoa(crypto.randomUUID());
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : `'self' 'nonce-${nonce}'`;

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the CSP from the request headers to auto-nonce its own scripts.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on documents only; skip static assets, images and API routes.
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|editor/|.*\\.js$|.*\\.css$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
