"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adjustStock } from "@/app/(app)/inventario/actions";

export function AdjustStockDialog({
  variantId,
  label,
}: {
  variantId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const action = adjustStock.bind(null, variantId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Ajustar stock — ${label}`}>
        <form action={action} onSubmit={() => setOpen(false)} className="flex flex-col gap-4">
          <div>
            <Label htmlFor={`delta-${variantId}`}>Cantidad (positivo suma, negativo resta)</Label>
            <Input id={`delta-${variantId}`} name="delta" type="number" required placeholder="Ej: -2 o 5" />
          </div>
          <div>
            <Label htmlFor={`note-${variantId}`}>Motivo (opcional)</Label>
            <Textarea id={`note-${variantId}`} name="note" rows={2} placeholder="Ej: rotura, conteo físico..." />
          </div>
          <Button type="submit">Aplicar ajuste</Button>
        </form>
      </Dialog>
    </>
  );
}
