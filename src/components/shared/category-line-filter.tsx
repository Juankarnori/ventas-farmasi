import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export interface CategoryLineFilterProps {
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  categoryId: string;
  lineId: string;
  onCategoryChange: (id: string) => void;
  onLineChange: (id: string) => void;
  className?: string;
  // Buscador opcional por nombre o código (sku) — si se pasan estos dos
  // props se muestra un input de texto arriba de los selects; si se
  // omiten, el componente se comporta exactamente igual que antes (solo
  // categoría/línea), así que agregar esto no afecta a ningún uso
  // existente que no lo pida.
  query?: string;
  onQueryChange?: (value: string) => void;
}

// Filtro Categoría + Línea (+ buscador opcional) reutilizado en
// Catálogo, Pedidos, Ventas, Préstamos y Uso personal. Es un componente
// controlado puro (sin lógica de URL ni de estado propio) para que cada
// pantalla lo conecte a lo que le corresponda: Catálogo lo sincroniza
// con la URL, el resto lo guarda en estado local del formulario.
// `onCategoryChange` es responsabilidad de quien llama resetear también
// la línea activa en el mismo paso (una línea de otra categoría ya no
// aplica) — no se hace acá adentro para no disparar dos actualizaciones
// separadas que puedan pisarse entre sí (ej. dos `router.replace`
// seguidos leyendo un searchParams desactualizado).
export function CategoryLineFilter({
  categories,
  lines,
  categoryId,
  lineId,
  onCategoryChange,
  onLineChange,
  className,
  query,
  onQueryChange,
}: CategoryLineFilterProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {onQueryChange && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <Input
            value={query ?? ""}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="pl-9"
          />
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-56">
          <Select
            aria-label="Categoría"
            value={categoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-56">
          <Select
            aria-label="Línea"
            value={lineId}
            onChange={(e) => onLineChange(e.target.value)}
            disabled={lines.length === 0}
          >
            <option value="">Todas las líneas</option>
            {categoryId
              ? lines
                  .filter((l) => l.category_id === categoryId)
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
    </div>
  );
}
