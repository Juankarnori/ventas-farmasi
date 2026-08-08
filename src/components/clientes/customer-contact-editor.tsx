"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { formatBirthday, calculateAge } from "@/lib/utils/date";
import { updateCustomerContact } from "@/app/(app)/clientes/actions";

export function CustomerContactEditor({
  customerId,
  name,
  phone,
  birthDate,
  notes,
  defaultEditing = false,
}: {
  customerId: string;
  name: string;
  phone: string | null;
  birthDate: string | null;
  notes: string | null;
  // Para el ícono de editar en la tarjeta del listado (?edit=1): abre
  // directamente en modo edición al entrar, sin el clic extra de "Editar"
  // acá adentro.
  defaultEditing?: boolean;
}) {
  const [editing, setEditing] = useState(defaultEditing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = updateCustomerContact.bind(null, customerId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await action(new FormData(e.currentTarget));
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{name}</h1>
          <div className="mt-1 flex items-center gap-1.5">
            <p className="text-sm text-ink/60">{phone ?? "Sin teléfono"}</p>
            <WhatsAppButton phone={phone} />
          </div>
          {birthDate && (
            <p className="mt-0.5 text-sm text-ink/60">
              🎂 {formatBirthday(birthDate)} · {calculateAge(birthDate)} años
            </p>
          )}
          {notes && <p className="mt-2 max-w-md text-sm text-ink/70">{notes}</p>}
        </div>
        {/* Mismo lenguaje visual (Pencil + texto "Editar", píldora clara)
            que el botón de editar en SaleCard — para que se sienta la
            misma acción en toda la app, no un icono aislado. */}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <div className="w-44">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={phone ?? ""} />
        </div>
        <div className="w-44">
          <Label htmlFor="birth_date">Cumpleaños</Label>
          <Input id="birth_date" name="birth_date" type="date" defaultValue={birthDate ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notas y preferencias</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={notes ?? ""}
          placeholder="Ej: prefiere tonos coral, alérgica a fragancias fuertes, siempre pregunta por novedades de skincare..."
        />
      </div>
      {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Guardando..." : "Guardar"}
        </Button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-ink/60 hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-4 w-4" /> Cancelar
        </button>
      </div>
    </form>
  );
}
