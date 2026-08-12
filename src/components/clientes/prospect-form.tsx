"use client";

import { useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ProspectType } from "@/lib/types/database.types";

export interface ProspectDefaults {
  name: string;
  phone: string | null;
  type: ProspectType;
  note: string | null;
  firstContactDate: string | null;
}

// Alta/edición de un prospecto — mismo patrón que FollowUpRuleForm: sin
// `defaults` es de alta, con `defaults` es de edición.
export function ProspectForm({
  action,
  defaults,
  submitLabel = "Crear prospecto",
  onCancel,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<{ error?: string }>;
  defaults?: ProspectDefaults;
  submitLabel?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await action(new FormData(e.currentTarget));
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onSuccess?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={defaults?.name} required />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" name="phone" defaultValue={defaults?.phone ?? ""} />
        </div>
        <div className="w-56">
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" name="type" defaultValue={defaults?.type ?? "venta"}>
            <option value="venta">Venta (interesada en comprar)</option>
            <option value="ingreso">Ingreso (interesada en sumarse)</option>
          </Select>
        </div>
        <div className="w-48">
          <Label htmlFor="first_contact_date">Primer contacto (opcional)</Label>
          <Input
            id="first_contact_date"
            name="first_contact_date"
            type="date"
            defaultValue={defaults?.firstContactDate ?? ""}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="note">Observación (opcional)</Label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={defaults?.note ?? ""}
          placeholder="Ej: quedó en llamarla la próxima semana"
        />
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
