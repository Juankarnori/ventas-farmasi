"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runBirthdayCheckManually } from "@/app/(app)/clientes/reglas/actions";

// Dispara run_birthday_check a mano. Invocado por onClick + try/catch (no
// <form action={...}> directo) para que un error no se propague sin
// control y crashee la página — mismo patrón que StockStepper y el resto
// de las acciones de esta sección.
export function RunBirthdayCheckButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const result = await runBirthdayCheckManually();
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" size="sm" variant="ghost" onClick={run} disabled={busy}>
        <RefreshCw className="h-4 w-4" /> {busy ? "Revisando..." : "Revisar cumpleaños ahora"}
      </Button>
      {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
    </div>
  );
}
