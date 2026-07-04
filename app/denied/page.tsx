import ErrorShell from "../error-shell";

export const metadata = { title: "Acceso denegado — MapGen" };

export default function DeniedPage() {
  return (
    <ErrorShell
      code="403"
      title="Acceso denegado"
      message="Tu cuenta no tiene permisos para esta sección. Si crees que es un error, contacta a un administrador."
    />
  );
}
