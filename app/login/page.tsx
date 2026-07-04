import LoginForm from "./login-form";

export const metadata = { title: "Iniciar sesión — MapGen" };

export default function LoginPage() {
  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">MapGen</span>
          <small>Editor de mapas y enlaces</small>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
