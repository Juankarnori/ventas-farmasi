"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteCustomer } from "@/app/(app)/clientes/actions";

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const { result, error } = await deleteCustomer(customerId);
    setBusy(false);
    if (error) {
      setError(error);
    } else if (result === "archived") {
      // Tenía ventas o seguimientos asociados — se archivó en vez de
      // borrarse de verdad. Se queda en el diálogo mostrando esto en
      // vez de navegar directo, para que no parezca que no pasó nada.
      setArchived(true);
    } else {
      router.push("/clientes");
    }
  }

  function close() {
    setOpen(false);
    setArchived(false);
    setError(null);
    if (archived) router.push("/clientes");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-ink/50 hover:bg-accent/20 hover:text-ink"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar clienta
      </button>

      <Dialog open={open} onClose={close} title={archived ? "Clienta archivada" : "¿Eliminar clienta?"}>
        {archived ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink/70">
              <strong className="text-ink">{customerName}</strong> tiene ventas o seguimientos
              asociados, así que se archivó en vez de borrarse: ya no va a aparecer en el listado,
              pero su historial se conserva tal cual.
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Entendido
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink/70">
              Si <strong className="text-ink">{customerName}</strong> no tiene ventas ni
              seguimientos asociados, se borra de verdad. Si tiene, se archiva en su lugar — deja de
              aparecer en el listado, pero no se pierde nada de su historial.
            </p>
            {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" onClick={confirmDelete} disabled={busy}>
                {busy ? "Eliminando..." : "Sí, eliminar"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
