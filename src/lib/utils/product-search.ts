// Filtro compartido de categoría/línea/búsqueda para los selectores de
// producto de Pedidos, Ventas, Préstamos y Uso personal — una sola
// implementación de "qué cuenta como match" para que buscar por código
// (sku) funcione igual en los cuatro, en vez de reimplementar el mismo
// .filter() en cada formulario. El match por texto es por nombre O por
// el código de cualquiera de sus variantes (no hace falta escribir el
// nombre exacto si ya se sabe el código corto).
export interface FilterableProduct {
  name: string;
  category_id: string | null;
  line_id: string | null;
  variants: { sku?: string | null }[];
}

export function filterProducts<T extends FilterableProduct>(
  products: T[],
  { categoryId, lineId, query }: { categoryId: string; lineId: string; query: string },
): T[] {
  const q = query.trim().toLowerCase();

  return products.filter((p) => {
    if (categoryId && p.category_id !== categoryId) return false;
    if (lineId && p.line_id !== lineId) return false;
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    return p.variants.some((v) => (v.sku ?? "").toLowerCase().includes(q));
  });
}
