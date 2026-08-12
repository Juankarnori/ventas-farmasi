"use client";

import { useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { FollowUpTriggerType } from "@/lib/types/database.types";

export interface FollowUpRuleDefaults {
  name: string;
  trigger_type: FollowUpTriggerType;
  days_after: number | null;
  message_template: string;
}

// Formulario de alta/edición de una regla. `trigger_type` controla si se
// pide "días después" (tiene sentido para 'despues_de_venta' y
// 'despues_de_contacto' — las dos cuentan desde una fecha base; un
// cumpleaños ya trae su propio "día" en la fecha de nacimiento).
export function FollowUpRuleForm({
  action,
  defaults,
  submitLabel = "Crear regla",
  onCancel,
}: {
  action: (formData: FormData) => Promise<{ error?: string }>;
  defaults?: FollowUpRuleDefaults;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  const [triggerType, setTriggerType] = useState<FollowUpTriggerType>(
    defaults?.trigger_type ?? "despues_de_venta",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // <form action={action}> directo dejaba que un error de la Server
  // Action (ej. validación de parseRuleForm) se propagara sin control y
  // crasheara toda la página con la pantalla genérica de Next.js — mismo
  // patrón ya corregido en StockStepper/AdjustStockDialog. Acá se
  // intercepta el submit a mano y la acción devuelve { error? } en vez de
  // tirarlo, así el mensaje real le llega al cliente incluso en
  // producción (donde Next.js oculta el mensaje de cualquier throw no
  // atrapado en una Server Action).
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await action(new FormData(e.currentTarget));
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nombre de la regla</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaults?.name}
          placeholder="Ej: Check-in post-venta"
          required
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-56">
          <Label htmlFor="trigger_type">Se activa</Label>
          <Select
            id="trigger_type"
            name="trigger_type"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as FollowUpTriggerType)}
          >
            <option value="despues_de_venta">Después de una venta (Ventas)</option>
            <option value="cumpleanos">En el cumpleaños de la clienta (Ventas)</option>
            <option value="despues_de_contacto">Después del primer contacto (Prospectos)</option>
          </Select>
        </div>

        {triggerType !== "cumpleanos" && (
          <div className="w-40">
            <Label htmlFor="days_after">Días después</Label>
            <Input
              id="days_after"
              name="days_after"
              type="number"
              min={1}
              step={1}
              defaultValue={defaults?.days_after ?? undefined}
              required
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="message_template">Mensaje</Label>
        <Textarea
          id="message_template"
          name="message_template"
          rows={3}
          defaultValue={defaults?.message_template}
          placeholder="Ej: Hola {nombre}! Quería preguntarte cómo te fue con {productos} 💛"
          required
        />
        {triggerType === "despues_de_contacto" ? (
          <p className="mt-1 text-xs text-ink/50">
            Podés usar <code className="rounded bg-panel/60 px-1">{"{nombre}"}</code> — se reemplaza
            solo por el nombre del prospecto al generar cada mensaje. Acá no aplican{" "}
            <code className="rounded bg-panel/60 px-1">{"{productos}"}</code>, un prospecto todavía no
            compró nada.
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink/50">
            Podés usar <code className="rounded bg-panel/60 px-1">{"{nombre}"}</code> y{" "}
            <code className="rounded bg-panel/60 px-1">{"{productos}"}</code> — se reemplazan solos al
            generar cada mensaje. Si la venta tuvo más de un producto, se listan todos (ej. &quot;Reviving
            Shampoo y Reviving Aceite Capilar&quot;).{" "}
            <code className="rounded bg-panel/60 px-1">{"{producto}"}</code> (singular) también funciona,
            por si ya tenías reglas guardadas así.
          </p>
        )}
      </div>

      {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Guardando..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
