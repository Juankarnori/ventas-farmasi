"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FollowUpRuleForm } from "./follow-up-rule-form";
import { BackfillFollowUpsButton } from "./backfill-follow-ups-button";
import { DeleteFollowUpRuleButton } from "./delete-follow-up-rule-button";
import { updateFollowUpRule, setFollowUpRuleActive } from "@/app/(app)/clientes/reglas/actions";
import type { Database } from "@/lib/types/database.types";

type FollowUpRule = Database["public"]["Tables"]["follow_up_rules"]["Row"];

// A qué le aplica cada regla — para que Ventas y Prospectos nunca se
// mezclen visualmente en la lista (cumpleanos/despues_de_venta son de
// Clientes que ya compraron; despues_de_contacto es de Prospectos).
const GROUP_LABEL = {
  despues_de_venta: "Ventas",
  cumpleanos: "Ventas",
  despues_de_contacto: "Prospectos",
} as const;

export function FollowUpRuleRow({ rule }: { rule: FollowUpRule }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setBusy(true);
    setError(null);
    const result = await setFollowUpRuleActive(rule.id, !rule.active);
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-gold/20 bg-surface p-4">
        <FollowUpRuleForm
          action={async (formData) => {
            const result = await updateFollowUpRule(rule.id, formData);
            if (!result.error) setEditing(false);
            return result;
          }}
          defaults={{
            name: rule.name,
            trigger_type: rule.trigger_type,
            days_after: rule.days_after,
            message_template: rule.message_template,
          }}
          submitLabel="Guardar cambios"
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-gold/20 bg-surface p-4 ${rule.active ? "" : "opacity-60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">{rule.name}</p>
            <Badge variant={rule.trigger_type === "despues_de_contacto" ? "accent" : "neutral"}>
              {GROUP_LABEL[rule.trigger_type]}
            </Badge>
            <Badge variant={rule.trigger_type === "cumpleanos" ? "gold" : "sage"}>
              {rule.trigger_type === "cumpleanos"
                ? "Cumpleaños"
                : rule.trigger_type === "despues_de_contacto"
                  ? `${rule.days_after} días después del primer contacto`
                  : `${rule.days_after} días después de la venta`}
            </Badge>
            {!rule.active && <Badge variant="neutral">Inactiva</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink/60">{rule.message_template}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar regla"
          className="rounded-full p-2 text-ink/40 hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="w-fit" disabled={busy} onClick={toggleActive}>
          {rule.active ? "Desactivar" : "Activar"}
        </Button>
        {/* Cumpleaños ya se recalcula solo todos los días vía el cron —
            este botón solo tiene sentido para reglas de después de la
            venta, que dependen de ventas puntuales ya registradas. */}
        {rule.trigger_type === "despues_de_venta" && <BackfillFollowUpsButton ruleId={rule.id} />}
        <DeleteFollowUpRuleButton ruleId={rule.id} ruleName={rule.name} ruleActive={rule.active} />
      </div>
    </div>
  );
}
