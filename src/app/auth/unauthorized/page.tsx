import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="font-display text-2xl text-ink">Acceso no autorizado</h1>
      <p className="max-w-sm text-sm text-ink/60">
        Este correo no está autorizado. Pedile a la administradora que te agregue desde el panel
        de Equipo.
      </p>
      <Link
        href="/auth/login"
        className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-primary/90"
      >
        Volver a intentar
      </Link>
    </div>
  );
}
