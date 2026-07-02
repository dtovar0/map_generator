import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MapGen — Editor de mapas",
  description: "Editor visual de mapas y enlaces",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nonce = headers().get("x-nonce") ?? undefined;
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          // Browsers blank out the nonce attribute after using it, so React's
          // hydration sees a mismatch on this inline script; the script is still
          // authorised and runs — suppress the (harmless) attribute warning.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mapgen_theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
