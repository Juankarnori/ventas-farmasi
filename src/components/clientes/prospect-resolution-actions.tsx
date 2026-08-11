"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { convertProspectToCustomer, discardProspect } from "@/app/(app)/clientes/prospectos/actions";
import type { ProspectStatus } from "@/lib/types/database.types";

// Las dos resoluciones finales de un prospecto — una vez convertido o
// descartado, no hay nada más que decidir acá (ya no se muestra nada).
export function ProspectResolutionActions({
  prospectId,
  status,
}: {
  prospectId: string;
  status: ProspectStatus;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"convert" | "discard" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "convertido" || status === "descartado") return null;

  async function confirmConvert() {
    setBusy(true);
    setError(null);
    const result = await convertProspectToCustomer(prospectId);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.push("/clientes");
  }

  async function confirmDiscard() {
    setBusy(true);
    setError(null);
    const result = await discardProspect(prospectId);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setDialog(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setDialog("convert")}>
          Convertir a Cliente
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setDialog("discard")}>
          Descartar
        </Button>
      </div>
      {error && <p className="mt-2 rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}

      <Dialog open={dialog === "convert"} onClose={() => setDialog(null)} title="¿Convertir a clienta?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Se va a crear un registro nuevo en Clientes con el mismo nombre y teléfono, y este
            prospecto queda marcado como convertido.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={confirmConvert} disabled={busy}>
              {busy ? "Convirtiendo..." : "Sí, convertir"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={dialog === "discard"} onClose={() => setDialog(null)} title="¿Descartar prospecto?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Queda marcado como descartado — no se borra, sigue disponible en el historial.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={confirmDiscard} disabled={busy}>
              {busy ? "Descartando..." : "Sí, descartar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
