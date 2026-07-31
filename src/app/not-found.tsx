import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl text-ink">Página no encontrada</h1>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
