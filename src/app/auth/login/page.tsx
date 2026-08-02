import { signInWithGoogle } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-14 w-24 overflow-hidden rounded-full ring-1 ring-gold/40">
        <span className="flex-1 bg-primary" />
        <span className="flex-1 bg-accent" />
      </div>
      <div>
        <h1 className="font-display text-2xl text-ink">Farmasi Bella</h1>
        <p className="mt-1 text-sm text-ink/60">Catálogo, ventas y finanzas compartidas</p>
      </div>

      {error && (
        <p className="rounded-md bg-accent/20 px-3 py-2 text-sm text-ink">
          No pudimos iniciar sesión. Probá de nuevo.
        </p>
      )}

      <form action={signInWithGoogle} className="w-full">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Continuar con Google
        </button>
      </form>

      <p className="text-xs text-ink/50">Solo para las cuentas de Mamá y Yo.</p>
    </div>
  );
}
