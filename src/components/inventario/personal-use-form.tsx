"use client";

import { useMemo, useState } from "react";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";
import { todayISO } from "@/lib/utils/date";

export interface PersonalUseProduct {
  id: string;
  name: string;
  category_id: string | null;
  line_id: string | null;
  variants: { id: string; color_name: string; stock: number }[];
}

export function PersonalUseForm({
  products,
  categories,
  lines,
  action,
}: {
  products: PersonalUseProduct[];
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

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [variantId, setVariantId] = useState(products[0]?.variants[0]?.id ?? "");

  const selectedProduct = productById.get(productId);
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === variantId);

  // Igual que en Catálogo/Pedidos/Ventas/Préstamos: las opciones del
  // select son la lista filtrada, más el producto ya elegido si el
  // filtro cambió después y ya no lo incluye.
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

  if (products.length === 0) {
    return <p className="text-sm text-ink/60">No tenés stock propio de ningún producto ahora mismo.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <CategoryLineFilter
        categories={categories}
        lines={lines}
        categoryId={filterCategoryId}
        lineId={filterLineId}
        onCategoryChange={onFilterCategoryChange}
        onLineChange={setFilterLineId}
      />

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="pu_product_id">Producto</Label>
          <Select id="pu_product_id" value={productId} onChange={(e) => onProductChange(e.target.value)}>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[160px] flex-1">
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
                {v.color_name} (tenés {v.stock})
              </option>
            ))}
          </Select>
        </div>
        <div className="w-28">
          <Label htmlFor="quantity">Cantidad</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={selectedVariant?.stock}
            defaultValue={1}
            required
          />
        </div>
        <div className="w-40">
          <Label htmlFor="used_at">Fecha</Label>
          <Input id="used_at" name="used_at" type="date" defaultValue={todayISO()} required />
        </div>
      </div>

      <div>
        <Label htmlFor="pu_note">Nota (opcional)</Label>
        <Textarea id="pu_note" name="note" rows={2} placeholder="Ej: para uso propio en casa" />
      </div>

      <Button type="submit" className="w-fit">
        Registrar uso personal
      </Button>
    </form>
  );
}
