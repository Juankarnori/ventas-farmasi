"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { formatDate } from "@/lib/utils/date";
import { completeFollowUpTask } from "@/app/(app)/clientes/actions";

export interface FollowUpTaskData {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  dueDate: string;
  messagePreview: string;
}

// "Hoy toca contactar": tareas pendientes con due_date <= hoy (incluye
// atrasadas). El mensaje es editable antes de mandarlo — nunca se envía
// solo, WhatsApp no lo permite sin la API de negocios de Meta; acá se
// arma el texto y la usuaria da el clic final desde su propio WhatsApp.
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
    try {
      await completeFollowUpTask(taskId, status);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la tarea. Intentá de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-accent/10 p-4">
      <div>
        <h2 className="font-display text-lg text-ink">Hoy toca contactar</h2>
        <p className="text-xs text-ink/60">
          {tasks.length} clienta{tasks.length === 1 ? "" : "s"} — el mensaje ya está armado, revisalo y
          mandalo por WhatsApp.
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
                <p className="font-medium text-ink">{task.customerName}</p>
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

              {!task.customerPhone && (
                <p className="text-[11px] text-ink/50">Sin teléfono — no se puede abrir WhatsApp.</p>
              )}

              <div className="flex items-center justify-between gap-2">
                <WhatsAppButton phone={task.customerPhone} message={messages[task.id]} />
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
