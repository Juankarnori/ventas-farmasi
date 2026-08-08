"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cancelApartado } from "@/app/(app)/ventas/actions";

export function CancelApartadoButton({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmCancel() {
    setBusy(true);
    setError(null);
    // Si sale bien, cancelApartado redirige (no vuelve a devolver el
    // control acá) — solo hay que manejar el caso de error.
    const result = await cancelApartado(saleId);
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" /> Cancelar apartado
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="¿Cancelar este apartado?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Se va a devolver el stock reservado a tu inventario. Los abonos ya registrados quedan
            como historial, pero el apartado se marca como cancelado. Esta acción no se puede
            deshacer.
          </p>
          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="button" variant="outline" onClick={confirmCancel} disabled={busy}>
              {busy ? "Cancelando..." : "Sí, cancelar apartado"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
