"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { deleteLoan } from "@/app/(app)/prestamos/actions";

// Eliminar un préstamo desde la tabla (Pendientes/Vendidos/Devueltos) —
// mensaje de confirmación distinto según qué se pierde en cada estado:
// pendiente devuelve el stock prestado, devuelto/vendido ya no tocan
// stock, y vendido con deuda sin liquidar avisa explícitamente de esa
// pérdida antes de dejar borrar (no bloquea, es decisión de la usuaria).
export function DeleteLoanButton({
  loanId,
  status,
  debtAmount,
  debtSettled,
}: {
  loanId: string;
  status: "pendiente" | "devuelto" | "vendido";
  debtAmount: number;
  debtSettled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteLoan(loanId);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  const hasPendingDebt = status === "vendido" && !debtSettled && debtAmount > 0;

  let message: string;
  if (status === "pendiente") {
    message =
      "Se va a eliminar este préstamo pendiente. El stock que se movió al prestarlo vuelve a quien prestó. Esta acción no se puede deshacer.";
  } else if (status === "devuelto") {
    message =
      "Se va a eliminar este préstamo ya devuelto. No afecta el stock — ya volvió a quien prestó cuando se marcó como devuelto. Esta acción no se puede deshacer.";
  } else if (hasPendingDebt) {
    message = `Este préstamo tiene una deuda pendiente de ${formatCurrency(debtAmount)} sin liquidar. Al eliminarlo, se pierde el registro de esa deuda. ¿Continuar de todas formas?`;
  } else {
    message = "Se va a eliminar este préstamo vendido. Esta acción no se puede deshacer.";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink/50 hover:bg-accent/20 hover:text-ink"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="¿Eliminar préstamo?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">{message}</p>
          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={confirmDelete} disabled={busy}>
              {busy ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
