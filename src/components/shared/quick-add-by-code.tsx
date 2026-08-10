"use client";

import { useRef, useState } from "react";
import { PackagePlus } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface QuickAddCodeProduct {
  id: string;
  variants: { id: string; sku?: string | null }[];
}

// Atajo para cargar productos por código (sku) sin pasar por el selector
// normal — pensado para escribir/pegar varios códigos seguidos rápido:
// busca la variante con ese código exacto entre TODOS los productos
// (sin importar el filtro de categoría/línea activo), le avisa a quien
// llama (`onFound` decide si suma cantidad a una fila existente o
// agrega una nueva), y vuelve a enfocar el campo listo para el
// siguiente. Mismo componente reutilizado en Ventas y Pedidos — ninguno
// de los dos reimplementa la búsqueda por su cuenta.
export function QuickAddByCode<T extends QuickAddCodeProduct>({
  products,
  onFound,
}: {
  products: T[];
  onFound: (productId: string, variantId: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = code.trim().toLowerCase();
    if (!target) return;

    for (const product of products) {
      const variant = product.variants.find((v) => (v.sku ?? "").toLowerCase() === target);
      if (variant) {
        onFound(product.id, variant.id);
        setCode("");
        setError(null);
        inputRef.current?.focus();
        return;
      }
    }

    setError("No se encontró ningún producto con ese código");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <div className="w-44">
          <Label htmlFor="quick_add_code">Agregar por código</Label>
          <Input
            id="quick_add_code"
            ref={inputRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            placeholder="Ej: COL-001"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          <PackagePlus className="h-4 w-4" /> Agregar
        </Button>
      </div>
      {error && <p className="w-fit rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
    </form>
  );
}
