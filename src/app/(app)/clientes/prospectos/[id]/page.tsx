import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { ProspectEditor } from "@/components/clientes/prospect-editor";
import { ProspectAppointments, type AppointmentRow } from "@/components/clientes/prospect-appointments";
import { ProspectResolutionActions } from "@/components/clientes/prospect-resolution-actions";
import type { ProspectType, ProspectStatus } from "@/lib/types/database.types";

const TYPE_LABEL: Record<ProspectType, string> = { ingreso: "Ingreso", venta: "Venta" };
const TYPE_VARIANT: Record<ProspectType, "sage" | "gold"> = { ingreso: "sage", venta: "gold" };
const STATUS_LABEL: Record<ProspectStatus, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  convertido: "Convertido",
  descartado: "Descartado",
};

export default async function ProspectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: prospect }, { data: appointments }] = await Promise.all([
    supabase.from("prospects").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("prospect_appointments")
      .select("*")
      .eq("prospect_id", id)
      .order("scheduled_at", { ascending: false }),
  ]);

  if (!prospect) {
    notFound();
  }

  const appointmentRows: AppointmentRow[] = (appointments ?? []).map((a) => ({
    id: a.id,
    scheduledAt: a.scheduled_at,
    note: a.note,
    status: a.status,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/clientes/prospectos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a prospectos
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={TYPE_VARIANT[prospect.type]}>{TYPE_LABEL[prospect.type]}</Badge>
        <Badge variant="neutral">{STATUS_LABEL[prospect.status]}</Badge>
        <WhatsAppButton phone={prospect.phone} className="relative z-10" />
      </div>

      <Card>
        <ProspectEditor
          prospectId={prospect.id}
          name={prospect.name}
          phone={prospect.phone}
          type={prospect.type}
          note={prospect.note}
          firstContactDate={prospect.first_contact_date}
        />
      </Card>

      <Card className="mt-4">
        <ProspectResolutionActions prospectId={prospect.id} status={prospect.status} />
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Citas</CardTitle>
        </CardHeader>
        <ProspectAppointments prospectId={prospect.id} appointments={appointmentRows} />
      </Card>
    </div>
  );
}
