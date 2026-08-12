"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";

// Filtro de categoría/línea para Inventario — mismo componente
// compartido que ya usan Catálogo, Pedidos, Ventas, Préstamos y Uso
// personal, sin buscador (acá no hace falta, la tabla ya agrupa por
// producto). Se guarda en la URL para que "Generar PDF" pueda
// heredarlo tal cual.
export function InventarioFilters({
  categories,
  lines,
}: {
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function onCategoryChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("categoria", value);
    else params.delete("categoria");
    // Resetea la línea activa en el mismo replace: una línea de otra
    // categoría ya no aplica.
    params.delete("linea");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <CategoryLineFilter
      categories={categories}
      lines={lines}
      categoryId={searchParams.get("categoria") ?? ""}
      lineId={searchParams.get("linea") ?? ""}
      onCategoryChange={onCategoryChange}
      onLineChange={(id) => updateParam("linea", id)}
    />
  );
}
