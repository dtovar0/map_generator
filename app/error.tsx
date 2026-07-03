"use client";

import { useEffect } from "react";
import ErrorShell from "./error-shell";

export default function ErrorPage({ error, reset: _reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Render error:", error.digest || error.message);
  }, [error]);
  return (
    <ErrorShell
      code="500"
      title="Algo salió mal"
      message="Ocurrió un error inesperado. Intenta de nuevo; si persiste, contacta al administrador."
    />
  );
}
