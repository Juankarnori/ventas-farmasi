"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";

// Edición del nombre/teléfono cargados en el propio apartado (por si se
// escribieron mal al momento de la venta) — no toca stock ni plata, mismo
// patrón inline que PaymentMethodEditor.
export function ApartadoCustomerEditor({
  customerName,
  customerPhone,
  action,
}: {
  customerName: string;
  customerPhone: string | null;
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
      <div className="flex items-center gap-1.5">
        <h1 className="font-display text-2xl text-ink">{customerName}</h1>
        {customerPhone && <WhatsAppButton phone={customerPhone} />}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar datos de la clienta"
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
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="customer_name">Nombre</Label>
          <Input id="customer_name" name="customer_name" defaultValue={customerName} required />
        </div>
        <div className="w-44">
          <Label htmlFor="customer_phone">Teléfono</Label>
          <Input id="customer_phone" name="customer_phone" defaultValue={customerPhone ?? ""} />
        </div>
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
