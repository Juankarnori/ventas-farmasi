import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

export interface CategoryLineFilterProps {
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  categoryId: string;
  lineId: string;
  onCategoryChange: (id: string) => void;
  onLineChange: (id: string) => void;
  className?: string;
}

// Filtro Categoría + Línea reutilizado en Catálogo, Pedidos y Ventas.
// Es un componente controlado puro (sin lógica de URL ni de estado
// propio) para que cada pantalla lo conecte a lo que le corresponda:
// Catálogo lo sincroniza con la URL, Pedidos/Ventas lo guardan en estado
// local del formulario. `onCategoryChange` es responsabilidad de quien
// llama resetear también la línea activa en el mismo paso (una línea de
// otra categoría ya no aplica) — no se hace acá adentro para no disparar
// dos actualizaciones separadas que puedan pisarse entre sí (ej. dos
// `router.replace` seguidos leyendo un searchParams desactualizado).
export function CategoryLineFilter({
  categories,
  lines,
  categoryId,
  lineId,
  onCategoryChange,
  onLineChange,
  className,
}: CategoryLineFilterProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row", className)}>
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
  );
}
