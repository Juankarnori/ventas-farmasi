"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateCustomerContact } from "@/app/(app)/ventas/clientes/actions";

export function CustomerContactEditor({
  customerId,
  name,
  phone,
}: {
  customerId: string;
  name: string;
  phone: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const action = updateCustomerContact.bind(null, customerId);

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{name}</h1>
          <p className="mt-1 text-sm text-ink/60">{phone ?? "Sin teléfono"}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar datos de la clienta"
          className="rounded-full p-2 text-ink/40 hover:bg-primary/10 hover:text-primary"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setEditing(false)}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="min-w-[160px] flex-1">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="w-44">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" name="phone" defaultValue={phone ?? ""} />
      </div>
      <Button type="submit" size="sm">
        Guardar
      </Button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancelar edición"
        className="rounded-full p-2 text-ink/40 hover:bg-ink/5"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
