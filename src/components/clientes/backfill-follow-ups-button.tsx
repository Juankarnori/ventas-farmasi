"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { countBackfillFollowUpTasks, backfillFollowUpTasks } from "@/app/(app)/clientes/reglas/actions";

type Step = "confirm" | "done";

// "Aplicar a ventas anteriores" — genera tareas de esta regla para
// ventas que ya existían antes de crearla/activarla. Antes de tocar
// nada, muestra cuántas se van a crear (podría ser bastante si hay
// mucho historial) para que no sea una sorpresa.
export function BackfillFollowUpsButton({ ruleId }: { ruleId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("confirm");
  const [count, setCount] = useState<number | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setStep("confirm");
    setError(null);
    setCount(null);
    try {
      const n = await countBackfillFollowUpTasks(ruleId);
      setCount(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular cuántas se generarían.");
    }
  }

  async function confirmApply() {
    setBusy(true);
    setError(null);
    try {
      const n = await backfillFollowUpTasks(ruleId);
      setCreated(n);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la regla. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={openDialog}>
        <History className="h-4 w-4" /> Aplicar a ventas anteriores
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title={step === "confirm" ? "¿Aplicar a ventas anteriores?" : "Listo"}
      >
        {step === "confirm" ? (
          <div className="flex flex-col gap-4">
            {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
            {count === null && !error ? (
              <p className="text-sm text-ink/60">Calculando...</p>
            ) : (
              count !== null && (
                <p className="text-sm text-ink/70">
                  {count === 0 ? (
                    "No hay ventas anteriores sin tarea para esta regla — ya está todo al día."
                  ) : (
                    <>
                      Esto va a generar <strong className="text-ink">{count}</strong> tarea
                      {count === 1 ? "" : "s"} de seguimiento para ventas anteriores — algunas pueden
                      quedar atrasadas si ya pasó su fecha, y van a aparecer así en &quot;Hoy toca
                      contactar&quot;. ¿Continuar?
                    </>
                  )}
                </p>
              )
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                {count === 0 ? "Cerrar" : "Cancelar"}
              </Button>
              {count !== null && count > 0 && (
                <Button type="button" variant="outline" onClick={confirmApply} disabled={busy}>
                  {busy ? "Aplicando..." : "Sí, aplicar"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink/70">
              Se {created === 1 ? "generó" : "generaron"} <strong className="text-ink">{created}</strong>{" "}
              tarea{created === 1 ? "" : "s"} de seguimiento. Ya las podés ver en &quot;Hoy toca
              contactar&quot; o en el Calendario.
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Entendido
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
