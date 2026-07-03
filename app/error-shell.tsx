interface ErrorShellProps {
  code: string;
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}

export default function ErrorShell({ code, title, message, actionHref = "/", actionLabel = "Volver al inicio" }: ErrorShellProps) {
  return (
    <main className="error-shell">
      <div className="error-card">
        <div className="error-code" aria-hidden="true">{code}</div>
        <h1 className="error-title">{title}</h1>
        <p className="error-message">{message}</p>
        <a className="error-action" href={actionHref}>{actionLabel}</a>
      </div>
    </main>
  );
}
