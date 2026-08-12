import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientesTabs } from "@/components/clientes/clientes-tabs";
import { NewFollowUpRule } from "@/components/clientes/new-follow-up-rule";
import { FollowUpRuleRow } from "@/components/clientes/follow-up-rule-row";
import { RunBirthdayCheckButton } from "@/components/clientes/run-birthday-check-button";

export default async function ReglasDeSeguimientoPage() {
  const supabase = await createClient();
  const { data: rules } = await supabase
    .from("follow_up_rules")
    .select("*")
    .order("created_at", { ascending: false });

  const active = (rules ?? []).filter((r) => r.active);
  const inactive = (rules ?? []).filter((r) => !r.active);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Clientes</h1>
        <p className="mt-1 text-sm text-ink/60">
          Reglas de seguimiento: cuándo y qué escribirle a una clienta o a un prospecto.
        </p>
      </div>

      <ClientesTabs active="reglas" />

      <div className="rounded-xl border border-gold/20 bg-panel/30 p-4 text-sm text-ink/70">
        WhatsApp no permite mandar mensajes automáticos sin la API de negocios de Meta (paga, con
        verificación). Estas reglas arman el mensaje y dejan la tarea lista en{" "}
        <strong>&quot;Hoy toca contactar&quot;</strong> — el envío final siempre lo hacés vos, con un
        clic, desde tu WhatsApp.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <NewFollowUpRule />
        <RunBirthdayCheckButton />
      </div>

      {(rules ?? []).length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Todavía no hay reglas de seguimiento"
          description="Creá una para que la app te avise cuándo contactar a cada clienta."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-ink/70">Activas ({active.length})</h2>
            {active.length === 0 ? (
              <p className="text-sm text-ink/50">No hay reglas activas.</p>
            ) : (
              active.map((rule) => <FollowUpRuleRow key={rule.id} rule={rule} />)
            )}
          </div>

          {inactive.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-ink/70">Inactivas ({inactive.length})</h2>
              {inactive.map((rule) => (
                <FollowUpRuleRow key={rule.id} rule={rule} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
