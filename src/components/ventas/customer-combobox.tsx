"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCustomerQuick, type CustomerOption } from "@/app/(app)/clientes/actions";

// Buscador con autocompletado sobre clientas existentes (por nombre o
// teléfono) + alta rápida inline si no existe. El campo de texto visible
// sigue enviándose como `customer_name` (compatibilidad con ventas
// anónimas/legado); `customer_id` viaja aparte en un input oculto y es
// el dato de verdad cuando hay una clienta seleccionada.
export function CustomerCombobox({
  customers,
  required,
  onSelect,
}: {
  customers: CustomerOption[];
  required?: boolean;
  onSelect?: (customer: CustomerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const matches = query.trim()
    ? customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
            (c.phone ?? "").includes(query.trim()),
        )
        .slice(0, 8)
    : [];

  const exactNameMatch = customers.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  function selectCustomer(c: CustomerOption) {
    setSelectedId(c.id);
    setQuery(c.name);
    setOpen(false);
    setCreating(false);
    setError(null);
    onSelect?.(c);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setSelectedId("");
    setCreating(false);
    setOpen(true);
    onSelect?.(null);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createCustomerQuick(name, newPhone.trim());
      if (result.error) {
        setError(result.error);
      } else if (result.customer) {
        selectCustomer(result.customer);
        setNewPhone("");
      }
    } catch {
      setError("No se pudo crear la clienta. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name="customer_id" value={selectedId} />
      <Label htmlFor="customer_search">Clienta{required ? "" : " (opcional)"}</Label>
      <Input
        id="customer_search"
        name="customer_name"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Buscar por nombre o teléfono..."
        required={required}
        autoComplete="off"
      />

      {open && query.trim() && !selectedId && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gold/20 bg-surface shadow-lg">
          {matches.length > 0 && (
            <ul className="max-h-56 overflow-y-auto">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-panel/40"
                  >
                    <span className="text-ink">{c.name}</span>
                    {c.phone && <span className="text-xs text-ink/40">{c.phone}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!exactNameMatch && (
            <div className="border-t border-ink/10 p-2">
              {!creating ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm text-primary hover:bg-primary/10"
                >
                  <UserPlus className="h-4 w-4" /> Crear clienta “{query.trim()}”
                </button>
              ) : (
                <div className="flex flex-col gap-2 p-1">
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Teléfono (opcional)"
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={handleCreate} disabled={busy}>
                    {busy ? "Creando..." : "Crear y usar"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>
      )}
    </div>
  );
}
