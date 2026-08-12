import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientesTabs } from "@/components/clientes/clientes-tabs";
import { ProspectCard, type ProspectCardData } from "@/components/clientes/prospect-card";

export default async function ProspectosPage() {
  const supabase = await createClient();

  const [{ data: prospects }, { data: appointments }] = await Promise.all([
    supabase.from("prospects").select("*").order("created_at", { ascending: false }),
    // Ya vienen ordenadas por fecha — la primera que aparezca para cada
    // prospecto en el loop de abajo es la más próxima.
    supabase
      .from("prospect_appointments")
      .select("prospect_id, scheduled_at")
      .eq("status", "pendiente")
      .order("scheduled_at", { ascending: true }),
  ]);

  const nextAppointmentByProspect = new Map<string, string>();
  for (const a of appointments ?? []) {
    if (!nextAppointmentByProspect.has(a.prospect_id)) {
      nextAppointmentByProspect.set(a.prospect_id, a.scheduled_at);
    }
  }

  const cards: ProspectCardData[] = (prospects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    type: p.type,
    status: p.status,
    note: p.note,
    firstContactDate: p.first_contact_date,
    nextAppointment: nextAppointmentByProspect.get(p.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Clientes</h1>
          <p className="mt-1 text-sm text-ink/60">
            {cards.length} prospecto{cards.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/clientes/prospectos/nuevo">
          <Button>
            <Plus className="h-4 w-4" /> Nuevo prospecto
          </Button>
        </Link>
      </div>

      <ClientesTabs active="prospectos" />

      <div>
        {cards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((p) => (
              <ProspectCard key={p.id} prospect={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={UserPlus}
            title="Todavía no hay prospectos"
            description="Agregá a alguien interesada en comprar o en sumarse como vendedora."
            action={
              <Link href="/clientes/prospectos/nuevo">
                <Button size="sm">Nuevo prospecto</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
