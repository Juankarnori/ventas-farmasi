"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cancelApartado } from "@/app/(app)/ventas/actions";

export function CancelApartadoButton({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  const action = cancelApartado.bind(null, saleId);

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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <form action={action}>
              <Button type="submit" variant="outline">
                Sí, cancelar apartado
              </Button>
            </form>
          </div>
        </div>
      </Dialog>
    </>
  );
}
