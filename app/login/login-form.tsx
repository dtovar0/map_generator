"use client";

import { useEffect, useState, type FormEvent } from "react";

const QUERY_ERRORS: Record<string, string> = {
  oidc: "No se pudo completar el acceso con Authelia. Intenta de nuevo.",
  inactive: "Tu cuenta está desactivada. Contacta a un administrador.",
};

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next") || "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginForm() {
  const [modes, setModes] = useState<{ local: boolean; oidc: boolean } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const queryError = new URLSearchParams(window.location.search).get("error");
    if (queryError && QUERY_ERRORS[queryError]) setError(QUERY_ERRORS[queryError]);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { user: unknown; modes: { local: boolean; oidc: boolean } }) => {
        if (data.user) { window.location.replace(safeNext()); return; }
        setModes(data.modes);
      })
      .catch(() => setModes({ local: true, oidc: false }));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String((data as { error?: string }).error || "No se pudo iniciar sesión"));
        return;
      }
      window.location.replace(safeNext());
    } catch {
      setError("No se pudo contactar al servidor");
    } finally {
      setBusy(false);
    }
  }

  if (!modes) return null;
  return (
    <>
      {error ? <p className="login-error" role="alert">{error}</p> : null}
      {modes.local ? (
        <form className="login-form" onSubmit={submit}>
          <div className="login-field">
            <label htmlFor="login-username">Usuario</label>
            <input id="login-username" autoComplete="username" autoFocus required maxLength={190}
              value={username} onChange={(event) => setUsername(event.target.value)} />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Contraseña</label>
            <input id="login-password" type="password" autoComplete="current-password" required
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      ) : null}
      {modes.local && modes.oidc ? <div className="login-divider">o</div> : null}
      {modes.oidc ? <a className="login-oidc" href="/api/auth/oidc/start">Entrar con Authelia</a> : null}
      {!modes.local && !modes.oidc ? (
        <p className="login-error">No hay métodos de acceso habilitados. Contacta al administrador.</p>
      ) : null}
    </>
  );
}
