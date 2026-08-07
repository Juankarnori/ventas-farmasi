"use client";

import { useMemo, useState } from "react";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";

export interface LoanableProduct {
  id: string;
  name: string;
  category_id: string | null;
  line_id: string | null;
  variants: { id: string; color_name: string }[];
}

export function LoanForm({
  products,
  profiles,
  categories,
  lines,
  action,
}: {
  products: LoanableProduct[];
  profiles: { id: string; display_name: string }[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterLineId, setFilterLineId] = useState("");

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (filterCategoryId && p.category_id !== filterCategoryId) return false;
        if (filterLineId && p.line_id !== filterLineId) return false;
        return true;
      }),
    [products, filterCategoryId, filterLineId],
  );

  function onFilterCategoryChange(id: string) {
    setFilterCategoryId(id);
    setFilterLineId("");
  }

  const [productId, setProductId] = useState(() => products[0]?.id ?? "");
  const [variantId, setVariantId] = useState(products[0]?.variants[0]?.id ?? "");

  const selectedProduct = productById.get(productId);

  // Igual que en Pedidos/Ventas: las opciones del select son la lista
  // filtrada, más el producto ya elegido si el filtro cambió después y ya
  // no lo incluye (para no romper la selección actual).
  const productOptions =
    filteredProducts.length === 0 || filteredProducts.some((p) => p.id === productId)
      ? filteredProducts
      : selectedProduct
        ? [selectedProduct, ...filteredProducts]
        : filteredProducts;

  function onProductChange(id: string) {
    setProductId(id);
    setVariantId(productById.get(id)?.variants[0]?.id ?? "");
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="direction">De quién a quién</Label>
        <Select id="direction" name="direction" required>
          {profiles.map((from) =>
            profiles
              .filter((to) => to.id !== from.id)
              .map((to) => (
                <option key={`${from.id}:${to.id}`} value={`${from.id}:${to.id}`}>
                  {from.display_name} → {to.display_name}
                </option>
              )),
          )}
        </Select>
      </div>

      <CategoryLineFilter
        categories={categories}
        lines={lines}
        categoryId={filterCategoryId}
        lineId={filterLineId}
        onCategoryChange={onFilterCategoryChange}
        onLineChange={setFilterLineId}
      />

      <div>
        <Label htmlFor="product_id">Producto</Label>
        <Select id="product_id" value={productId} onChange={(e) => onProductChange(e.target.value)}>
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="variant_id">Color</Label>
        <Select
          id="variant_id"
          name="variant_id"
          required
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
        >
          {selectedProduct?.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.color_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-32">
        <Label htmlFor="quantity">Cantidad</Label>
        <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
      </div>

      <div>
        <Label htmlFor="valuation_type">Si no se devuelve, se valora...</Label>
        <Select id="valuation_type" name="valuation_type" defaultValue="costo">
          <option value="costo">Al costo (para completar un pedido/reposición)</option>
          <option value="pvp">A precio de venta (para que lo venda ella)</option>
        </Select>
        <p className="mt-1 text-xs text-ink/50">
          Si el préstamo termina marcado como &quot;vendido&quot; en vez de devuelto, la deuda se
          calcula con este valor — a costo si era para ayudar a completar algo, a precio de venta si
          quien prestó pierde la ganancia que hubiera hecho vendiéndolo ella misma.
        </p>
      </div>

      <div>
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" name="note" rows={2} placeholder="Ej: para probarlo con una clienta" />
      </div>

      <Button type="submit" disabled={products.length === 0}>
        Registrar préstamo
      </Button>
    </form>
  );
}
