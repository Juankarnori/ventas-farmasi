"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { formatDate } from "@/lib/utils/date";
import { completeFollowUpTask } from "@/app/(app)/clientes/actions";
import type { PendingFollowUp } from "@/lib/queries/pending-follow-ups";

// Reexportado con el nombre que ya usaba este componente — el shape es
// el mismo que devuelve getPendingFollowUps(), fuente única para esta
// vista, para Inicio, y para cualquier otro lugar que necesite lo mismo.
export type FollowUpTaskData = PendingFollowUp;

// "Hoy toca contactar": tareas pendientes con due_date <= hoy (incluye
// atrasadas), tanto de Clientes como de Prospectos. El mensaje es
// editable antes de mandarlo — nunca se envía solo, WhatsApp no lo
// permite sin la API de negocios de Meta; acá se arma el texto y la
// usuaria da el clic final desde su propio WhatsApp.
export function FollowUpToday({ tasks: initialTasks }: { tasks: FollowUpTaskData[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [messages, setMessages] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTasks.map((t) => [t.id, t.messagePreview])),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  async function resolve(taskId: string, status: "hecho" | "omitido") {
    setBusyId(taskId);
    setError(null);
    const result = await completeFollowUpTask(taskId, status);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-accent/10 p-4">
      <div>
        <h2 className="font-display text-lg text-ink">Hoy toca contactar</h2>
        <p className="text-xs text-ink/60">
          {tasks.length} contacto{tasks.length === 1 ? "" : "s"} — el mensaje ya está armado, revisalo
          y mandalo por WhatsApp.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => {
          const busy = busyId === task.id;
          return (
            <div
              key={task.id}
              className="flex flex-col gap-2 rounded-xl border border-gold/20 bg-surface p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-ink">{task.contactName}</p>
                  {/* Distingue de un vistazo si esto es un prospecto (no
                      compró todavía) o una clienta ya conocida. */}
                  {task.isProspect && (
                    <Badge variant="accent" className="gap-1">
                      <UserPlus className="h-3 w-3" /> Prospecto
                    </Badge>
                  )}
                </div>
                <span className="whitespace-nowrap text-[11px] text-ink/50">
                  Vence {formatDate(task.dueDate)}
                </span>
              </div>

              <Textarea
                value={messages[task.id] ?? ""}
                onChange={(e) => setMessages((prev) => ({ ...prev, [task.id]: e.target.value }))}
                rows={3}
                className="text-xs"
              />

              {!task.contactPhone && (
                <p className="text-[11px] text-ink/50">Sin teléfono — no se puede abrir WhatsApp.</p>
              )}

              <div className="flex items-center justify-between gap-2">
                <WhatsAppButton phone={task.contactPhone} message={messages[task.id]} />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => resolve(task.id, "omitido")}
                  >
                    Omitir
                  </Button>
                  <Button type="button" size="sm" disabled={busy} onClick={() => resolve(task.id, "hecho")}>
                    {busy ? "..." : "Marcar contactado"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
