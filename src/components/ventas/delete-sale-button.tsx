"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { deleteSale } from "@/app/(app)/ventas/actions";

// Eliminar una venta (de contado o apartado) desde su tarjeta en el
// listado — el stock vuelve a quien la vendió y se borra todo lo que
// dependía de ella (ver delete_sale). Si ya tiene abonos registrados
// (sale_payments — un apartado en curso o ya completado), el mensaje de
// confirmación avisa explícitamente cuánto se pierde antes de dejar
// borrar; no bloquea nada, es decisión de la usuaria.
export function DeleteSaleButton({
  saleId,
  paidAmount,
  className,
  compact = false,
}: {
  saleId: string;
  paidAmount: number;
  className?: string;
  // Icono solo, sin el texto "Eliminar" — para cuando vive apretado
  // junto a un badge de estado (ver ApartadoCard) en vez de al lado de
  // otro botón con lugar de sobra (ver SaleCard).
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteSale(saleId);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  const hasPayments = paidAmount > 0;
  const message = hasPayments
    ? `Esta venta es un apartado con ${formatCurrency(paidAmount)} ya abonado. Al eliminarla, se pierde el registro de ese dinero recibido. El stock vendido vuelve a tu inventario. ¿Continuar de todas formas?`
    : "Se va a revertir el stock vendido a tu inventario y se va a borrar el registro completo de esta venta. Esta acción no se puede deshacer.";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Evita que el click dispare el link de fondo cuando esto vive
          // arriba de una tarjeta clickeable (ver ApartadoCard).
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Eliminar venta"
        className={className ?? "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink/50 hover:bg-accent/20 hover:text-ink"}
      >
        <Trash2 className="h-3.5 w-3.5" /> {!compact && "Eliminar"}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="¿Eliminar esta venta?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">{message}</p>
          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={confirmDelete} disabled={busy}>
              {busy ? "Eliminando..." : "Sí, eliminar venta"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
