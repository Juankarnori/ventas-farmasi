"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentMethodField } from "./payment-method-field";
import type { PaymentMethod } from "@/lib/types/database.types";

// Editor inline de método de pago + nota de banco — no toca productos ni
// stock, así que es la única parte editable de un apartado desde acá (ver
// update_sale_payment_method en 0025_sale_payment_method_and_edit.sql).
export function PaymentMethodEditor({
  paymentMethod,
  bankNote,
  action,
}: {
  paymentMethod: PaymentMethod;
  bankNote: string | null;
  action: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await action(new FormData(e.currentTarget));
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-ink/70">
        <span>
          {paymentMethod === "transferencia" ? "🏦 Transferencia" : "💵 Efectivo"}
          {bankNote && ` · ${bankNote}`}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar método de pago"
          className="rounded-full p-1.5 text-ink/40 hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <PaymentMethodField defaultMethod={paymentMethod} defaultBankNote={bankNote} />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Guardando..." : "Guardar"}
        </Button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          aria-label="Cancelar edición"
          className="rounded-full p-2 text-ink/40 hover:bg-ink/5"
        >
          <X className="h-4 w-4" />
        </button>
      </form>
      {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
    </div>
  );
}
