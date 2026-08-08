"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/date";
import { registerPayment } from "@/app/(app)/ventas/actions";

export function RegisterPaymentDialog({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = registerPayment.bind(null, saleId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await action(new FormData(e.currentTarget));
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" /> Registrar abono
      </Button>
      <Dialog open={open} onClose={close} title="Registrar abono">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="amount">Monto</Label>
            <Input id="amount" name="amount" type="number" min={0.01} step="0.01" required />
          </div>
          <div>
            <Label htmlFor="payment_date">Fecha</Label>
            <Input id="payment_date" name="payment_date" type="date" defaultValue={todayISO()} required />
          </div>
          <div>
            <Label htmlFor="method">Método (opcional)</Label>
            <Input id="method" name="method" placeholder="Ej: efectivo, transferencia" />
          </div>
          <div>
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea id="note" name="note" rows={2} />
          </div>
          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando..." : "Guardar abono"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
