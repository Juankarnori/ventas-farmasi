"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cancelOrder } from "@/app/(app)/pedidos/actions";

// Solo tiene sentido mientras el pedido está pendiente (ver
// cancel_order) — un pedido pendiente todavía no sumó nada de stock, así
// que cancelarlo no revierte nada.
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmCancel() {
    setBusy(true);
    setError(null);
    const result = await cancelOrder(orderId);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" /> Cancelar pedido
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="¿Cancelar este pedido?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Todavía está pendiente, así que no había sumado nada al stock — cancelarlo no mueve
            nada, solo queda marcado como cancelado en el historial. Esta acción no se puede
            deshacer.
          </p>
          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="button" variant="outline" onClick={confirmCancel} disabled={busy}>
              {busy ? "Cancelando..." : "Sí, cancelar pedido"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
