import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { formatDate } from "@/lib/utils/date";
import type { ProspectType, ProspectStatus } from "@/lib/types/database.types";

export interface ProspectCardData {
  id: string;
  name: string;
  phone: string | null;
  type: ProspectType;
  status: ProspectStatus;
  note: string | null;
  firstContactDate: string | null;
  // Próxima cita pendiente (la más cercana), si tiene alguna agendada.
  nextAppointment: string | null;
}

const TYPE_LABEL: Record<ProspectType, string> = { ingreso: "Ingreso", venta: "Venta" };
const TYPE_VARIANT: Record<ProspectType, "sage" | "gold"> = { ingreso: "sage", venta: "gold" };

const STATUS_LABEL: Record<ProspectStatus, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  convertido: "Convertido",
  descartado: "Descartado",
};
const STATUS_VARIANT: Record<ProspectStatus, "gold" | "sage" | "accent" | "neutral"> = {
  pendiente: "gold",
  contactado: "accent",
  convertido: "sage",
  descartado: "neutral",
};

export function ProspectCard({ prospect }: { prospect: ProspectCardData }) {
  return (
    // Mismo patrón "stretched link" que CustomerCard: la tarjeta entera
    // es clickeable, el botón de WhatsApp necesita su propio z-index para
    // interceptar el click antes que el link de fondo.
    <div className="relative rounded-2xl border border-gold/20 bg-panel/40 p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/clientes/prospectos/${prospect.id}`}
        aria-label={`Ver ${prospect.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />

      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink">{prospect.name}</p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Badge variant={TYPE_VARIANT[prospect.type]}>{TYPE_LABEL[prospect.type]}</Badge>
          <Badge variant={STATUS_VARIANT[prospect.status]}>{STATUS_LABEL[prospect.status]}</Badge>
        </div>
      </div>

      <div className="mt-0.5 flex items-center gap-1">
        <p className="text-xs text-ink/50">{prospect.phone ?? "Sin teléfono"}</p>
        <WhatsAppButton phone={prospect.phone} className="relative z-10 h-5 w-5" />
      </div>

      {prospect.firstContactDate && (
        <p className="mt-1 text-xs text-ink/50">Primer contacto: {formatDate(prospect.firstContactDate)}</p>
      )}

      {/* Solo si hay observación cargada — mismo criterio que las notas
          de Clientes: nada de placeholder ensuciando la tarjeta. */}
      {prospect.note && <p className="mt-2 line-clamp-2 text-xs text-ink/60">{prospect.note}</p>}

      {prospect.nextAppointment && (
        <p className="mt-2 text-xs font-medium text-primary">
          📅 {formatDate(prospect.nextAppointment, "d MMM yyyy, HH:mm")}
        </p>
      )}
    </div>
  );
}
