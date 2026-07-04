"use client";

import ErrorShell from "./error-shell";

export default function GlobalError({ error: _error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="es">
      <body>
        <ErrorShell
          code="500"
          title="Algo salió mal"
          message="Ocurrió un error inesperado. Intenta de nuevo; si persiste, contacta al administrador."
        />
      </body>
    </html>
  );
}
