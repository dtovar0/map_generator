import ErrorShell from "./error-shell";

export default function NotFound() {
  return (
    <ErrorShell
      code="404"
      title="Página no encontrada"
      message="La ruta que buscas no existe o fue movida."
    />
  );
}
