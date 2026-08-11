"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { createAppointment, updateAppointmentStatus } from "@/app/(app)/clientes/prospectos/actions";
import type { ProspectAppointmentStatus } from "@/lib/types/database.types";

export interface AppointmentRow {
  id: string;
  scheduledAt: string;
  note: string | null;
  status: ProspectAppointmentStatus;
}

const STATUS_LABEL: Record<ProspectAppointmentStatus, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
};
const STATUS_VARIANT: Record<ProspectAppointmentStatus, "gold" | "sage" | "neutral"> = {
  pendiente: "gold",
  completada: "sage",
  cancelada: "neutral",
};

// Agendar + historial de citas de un prospecto. El aviso de "falta poco
// para la cita" no vive acá — lo arma AppointmentReminderBanner en el
// layout, a partir de las mismas filas que se cargan acá.
export function ProspectAppointments({
  prospectId,
  appointments,
}: {
  prospectId: string;
  appointments: AppointmentRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createAppointment(prospectId, new FormData(e.currentTarget));
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      formRef.current?.reset();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-ink/10 p-3"
      >
        <div className="w-56">
          <Label htmlFor="scheduled_at">Fecha y hora</Label>
          <Input id="scheduled_at" name="scheduled_at" type="datetime-local" required />
        </div>
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="appt_note">Nota (opcional)</Label>
          <Input id="appt_note" name="note" placeholder="Ej: llamar para cerrar el pedido" />
        </div>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Agendando..." : "Agendar cita"}
        </Button>
      </form>

      {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}

      {appointments.length === 0 ? (
        <p className="text-sm text-ink/50">Todavía no hay citas agendadas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/20 bg-surface p-3 text-sm"
            >
              <div>
                <p className="font-medium text-ink">{formatDate(a.scheduledAt, "d MMM yyyy, HH:mm")}</p>
                {a.note && <p className="text-xs text-ink/60">{a.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                {a.status === "pendiente" && (
                  <div className="flex gap-1">
                    <ActionButton
                      action={() => updateAppointmentStatus(a.id, "completada")}
                      variant="ghost"
                      size="sm"
                      className="px-2 py-1 text-xs text-primary hover:bg-primary/10"
                      aria-label="Marcar completada"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </ActionButton>
                    <ActionButton
                      action={() => updateAppointmentStatus(a.id, "cancelada")}
                      variant="ghost"
                      size="sm"
                      className="px-2 py-1 text-xs text-ink/60 hover:bg-accent/20"
                      aria-label="Cancelar cita"
                    >
                      <X className="h-3.5 w-3.5" />
                    </ActionButton>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
