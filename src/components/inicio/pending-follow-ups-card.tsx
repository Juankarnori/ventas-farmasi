import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import type { PendingFollowUp } from "@/lib/queries/pending-follow-ups";

// Resumen de solo lectura — nada de WhatsApp ni "marcar contactado" acá
// a propósito (eso ya existe en Clientes → Hoy toca contactar); esto es
// solo "avisame que hay algo esperando", la acción se hace entrando ahí.
export function PendingFollowUpsCard({ tasks, previewCount = 5 }: { tasks: PendingFollowUp[]; previewCount?: number }) {
  const preview = tasks.slice(0, previewCount);

  return (
    <Card className="p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle>Seguimientos pendientes</CardTitle>
        <Link href="/clientes" className="text-xs font-medium text-primary hover:underline">
          Ir a Clientes
        </Link>
      </CardHeader>
      {tasks.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink/50">No hay seguimientos pendientes por ahora.</p>
      ) : (
        <>
          <p className="px-5 pb-2 text-xs text-ink/60">
            {tasks.length} contacto{tasks.length === 1 ? "" : "s"} esperando.
          </p>
          <ul className="flex flex-col divide-y divide-ink/10 pb-2">
            {preview.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="flex items-center gap-1.5 text-ink">
                  {t.contactName}
                  {t.isProspect && (
                    <Badge variant="accent" className="gap-1">
                      <UserPlus className="h-3 w-3" /> Prospecto
                    </Badge>
                  )}
                </span>
                <span className="whitespace-nowrap text-xs text-ink/50">Vence {formatDate(t.dueDate)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
