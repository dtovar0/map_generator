/** @type {import('next').NextConfig} */

// Content-Security-Policy is set per-request in middleware.ts (it needs a
// nonce). The remaining, static security headers live here and apply to every
// route.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  allowedDevOrigins: ["mapas.vivaro.com"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
