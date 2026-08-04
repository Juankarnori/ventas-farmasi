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
  const action = registerPayment.bind(null, saleId);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" /> Registrar abono
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Registrar abono">
        <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
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
          <Button type="submit">Guardar abono</Button>
        </form>
      </Dialog>
    </>
  );
}
