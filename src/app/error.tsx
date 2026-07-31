"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl text-ink">Algo salió mal</h1>
      <p className="max-w-sm text-sm text-ink/60">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background hover:bg-primary/90"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
