"use client";

import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updateLine, deleteLine } from "@/app/(app)/catalogo/categorias/actions";

export interface LineRowData {
  id: string;
  name: string;
  category_id: string;
}

export function LineRow({
  line,
  categories,
}: {
  line: LineRowData;
  categories: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const updateAction = updateLine.bind(null, line.id);

  if (editing) {
    return (
      <li className="py-3">
        <form
          action={updateAction}
          onSubmit={() => setEditing(false)}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[140px] flex-1">
            <Input name="name" defaultValue={line.name} required />
          </div>
          <div className="w-40">
            <Select name="category_id" defaultValue={line.category_id}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm">
            Guardar
          </Button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="Cancelar edición"
            className="rounded-full p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-3">
      <span className="text-sm text-ink">{line.name}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Editar línea ${line.name}`}
          className="rounded-full p-1.5 text-ink/40 hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <form action={deleteLine.bind(null, line.id)}>
          <button
            type="submit"
            aria-label={`Eliminar línea ${line.name}`}
            className="rounded-full p-1.5 text-ink/40 hover:bg-accent/20 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>
    </li>
  );
}
