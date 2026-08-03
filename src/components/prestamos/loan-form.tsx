"use client";

import { useMemo, useState } from "react";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface LoanableProduct {
  id: string;
  name: string;
  variants: { id: string; color_name: string }[];
}

export function LoanForm({
  products,
  profiles,
  action,
}: {
  products: LoanableProduct[];
  profiles: { id: string; display_name: string }[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [variantId, setVariantId] = useState(products[0]?.variants[0]?.id ?? "");

  const selectedProduct = productById.get(productId);

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

      <div>
        <Label htmlFor="product_id">Producto</Label>
        <Select
          id="product_id"
          value={productId}
          onChange={(e) => onProductChange(e.target.value)}
        >
          {products.map((p) => (
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
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" name="note" rows={2} placeholder="Ej: para probarlo con una clienta" />
      </div>

      <Button type="submit" disabled={products.length === 0}>
        Registrar préstamo
      </Button>
    </form>
  );
}
