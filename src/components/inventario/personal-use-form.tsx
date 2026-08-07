"use client";

import { useMemo, useState } from "react";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/date";

export interface PersonalUseProduct {
  id: string;
  name: string;
  variants: { id: string; color_name: string; stock: number }[];
}

export function PersonalUseForm({
  products,
  action,
}: {
  products: PersonalUseProduct[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [variantId, setVariantId] = useState(products[0]?.variants[0]?.id ?? "");

  const selectedProduct = productById.get(productId);
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === variantId);

  function onProductChange(id: string) {
    setProductId(id);
    setVariantId(productById.get(id)?.variants[0]?.id ?? "");
  }

  if (products.length === 0) {
    return <p className="text-sm text-ink/60">No tenés stock propio de ningún producto ahora mismo.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="pu_product_id">Producto</Label>
          <Select id="pu_product_id" value={productId} onChange={(e) => onProductChange(e.target.value)}>
            {products.map((p) => (
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
