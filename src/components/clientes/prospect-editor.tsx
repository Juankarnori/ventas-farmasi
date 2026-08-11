"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ProspectForm } from "./prospect-form";
import { updateProspect } from "@/app/(app)/clientes/prospectos/actions";
import type { ProspectType } from "@/lib/types/database.types";

// Ver/editar los datos del prospecto en la misma ficha — mismo patrón
// que FollowUpRuleRow: toggle entre una vista compacta y el formulario
// completo, sin salir de la página.
export function ProspectEditor({
  prospectId,
  name,
  phone,
  type,
  note,
}: {
  prospectId: string;
  name: string;
  phone: string | null;
  type: ProspectType;
  note: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ProspectForm
        action={(formData) => updateProspect(prospectId, formData)}
        defaults={{ name, phone, type, note }}
        submitLabel="Guardar cambios"
        onCancel={() => setEditing(false)}
        onSuccess={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-medium text-ink">{name}</p>
        <p className="mt-0.5 text-sm text-ink/60">{phone ?? "Sin teléfono"}</p>
        {note && <p className="mt-2 text-sm text-ink/70">{note}</p>}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar prospecto"
        className="shrink-0 rounded-full p-1.5 text-ink/40 hover:bg-primary/10 hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
