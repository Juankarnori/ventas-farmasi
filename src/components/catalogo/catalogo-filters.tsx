"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function CatalogoFilters({
  categories,
  lines,
}: {
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      else params.delete("q");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function onCategoryChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("categoria", value);
    else params.delete("categoria");
    // Resetea la línea activa: una línea de otra categoría ya no aplica.
    params.delete("linea");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function onLineChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("linea", value);
    else params.delete("linea");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  const activeCategoria = searchParams.get("categoria") ?? "";
  const activeLinea = searchParams.get("linea") ?? "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto..."
          className="pl-9"
        />
      </div>
      <div className="sm:w-56">
        <Select defaultValue={activeCategoria} onChange={(e) => onCategoryChange(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="sm:w-56">
        {/* key={activeCategoria} fuerza a remontar el select cuando cambia
            la categoría, para que el "value" no quede desincronizado del
            filtro de línea que se acaba de resetear en la URL. */}
        <Select
          key={activeCategoria}
          defaultValue={activeLinea}
          onChange={(e) => onLineChange(e.target.value)}
          disabled={lines.length === 0}
        >
          <option value="">Todas las líneas</option>
          {activeCategoria
            ? lines
                .filter((l) => l.category_id === activeCategoria)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
            : categories.map((category) => {
                const categoryLines = lines.filter((l) => l.category_id === category.id);
                if (categoryLines.length === 0) return null;
                return (
                  <optgroup key={category.id} label={category.name}>
                    {categoryLines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
        </Select>
      </div>
    </div>
  );
}
