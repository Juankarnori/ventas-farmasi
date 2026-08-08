"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteFollowUpRule, setFollowUpRuleActive } from "@/app/(app)/clientes/reglas/actions";

export function DeleteFollowUpRuleButton({
  ruleId,
  ruleName,
  ruleActive,
}: {
  ruleId: string;
  ruleName: string;
  ruleActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // null = todavía no se intentó / se puede intentar borrar directo;
  // string = se intentó y delete_follow_up_rule la rechazó por tener
  // historial — acá queda el mensaje real que explica por qué.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    const result = await deleteFollowUpRule(ruleId);
    setBusy(false);
    if (result?.error) {
      // No es un error inesperado: es exactamente la explicación de
      // delete_follow_up_rule ("ya generó N tareas...") — se muestra tal
      // cual en vez de un mensaje genérico. Llega acá como valor de
      // retorno, no como excepción — un throw se hubiera mostrado
      // redactado por Next.js en producción.
      setBlockedMessage(result.error);
    } else {
      setOpen(false);
    }
  }

  async function deactivateInstead() {
    setBusy(true);
    await setFollowUpRuleActive(ruleId, false);
    setBusy(false);
    setOpen(false);
  }

  function close() {
    setOpen(false);
    setBlockedMessage(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-ink/50 hover:bg-accent/20 hover:text-ink"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </button>

      <Dialog open={open} onClose={close} title={blockedMessage ? "No se puede eliminar" : "¿Eliminar esta regla?"}>
        {blockedMessage ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink/70">{blockedMessage}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cerrar
              </Button>
              {ruleActive && (
                <Button type="button" variant="outline" onClick={deactivateInstead} disabled={busy}>
                  {busy ? "Desactivando..." : "Desactivar en su lugar"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink/70">
              Se va a eliminar <strong className="text-ink">{ruleName}</strong> definitivamente. Esta
              acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
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
