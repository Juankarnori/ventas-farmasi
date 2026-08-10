"use client";

import { useMemo, useState } from "react";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";
import { filterProducts } from "@/lib/utils/product-search";
import { formatCurrency } from "@/lib/utils/currency";
import { loanUnitValue } from "@/lib/utils/loan-debt";
import type { LoanValuationType } from "@/lib/types/database.types";

export interface LoanableProduct {
  id: string;
  name: string;
  category_id: string | null;
  line_id: string | null;
  cost_price: number;
  sale_price: number;
  variants: {
    id: string;
    color_name: string;
    cost_override: number | null;
    price_override: number | null;
    sku: string | null;
  }[];
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
  const [query, setQuery] = useState("");

  const filteredProducts = useMemo(
    () => filterProducts(products, { categoryId: filterCategoryId, lineId: filterLineId, query }),
    [products, filterCategoryId, filterLineId, query],
  );

  function onFilterCategoryChange(id: string) {
    setFilterCategoryId(id);
    setFilterLineId("");
  }

  const [productId, setProductId] = useState(() => products[0]?.id ?? "");
  const [variantId, setVariantId] = useState(products[0]?.variants[0]?.id ?? "");
  const [valuationType, setValuationType] = useState<LoanValuationType>("costo");
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState("");
  const customPriceNumber = Number(customPrice);
  const hasValidCustomPrice = customPrice !== "" && Number.isFinite(customPriceNumber) && customPriceNumber > 0;

  const selectedProduct = productById.get(productId);
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === variantId);

  // Mismo cálculo que loanDebtAmount (guardado del préstamo) y que la
  // tabla del listado — acá se arma "en vivo" con el costo/precio del
  // catálogo (el préstamo todavía no existe) en vez de con valores ya
  // persistidos.
  const effectiveCost = selectedVariant?.cost_override ?? selectedProduct?.cost_price ?? 0;
  const effectivePrice = selectedVariant?.price_override ?? selectedProduct?.sale_price ?? 0;
  const unitValue =
    valuationType === "promocion"
      ? hasValidCustomPrice
        ? customPriceNumber
        : null
      : loanUnitValue({
          valuationType,
          unitCost: effectiveCost,
          unitPrice: effectivePrice,
          customPrice: null,
        });

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
        query={query}
        onQueryChange={setQuery}
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
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          required
        />
      </div>

      <div>
        <Label htmlFor="valuation_type">Si no se devuelve, se valora...</Label>
        <Select
          id="valuation_type"
          name="valuation_type"
          value={valuationType}
          onChange={(e) => setValuationType(e.target.value as LoanValuationType)}
        >
          <option value="costo">Al costo (para completar un pedido/reposición)</option>
          <option value="pvp">A precio de venta (para que lo venda ella)</option>
          <option value="promocion">En promoción (precio manual)</option>
        </Select>
        <p className="mt-1 text-xs text-ink/50">
          Si el préstamo termina marcado como &quot;vendido&quot; en vez de devuelto, la deuda se
          calcula con este valor — a costo si era para ayudar a completar algo, a precio de venta si
          quien prestó pierde la ganancia que hubiera hecho vendiéndolo ella misma, o al precio de
          promoción si el producto se compró puntualmente a un precio distinto de los dos anteriores.
        </p>
        {unitValue !== null && (
          <p className="mt-1 text-xs font-medium text-ink/70">
            Precio unitario: {formatCurrency(unitValue)} · Total: {formatCurrency(unitValue * quantity)} (
            {quantity} unidad{quantity === 1 ? "" : "es"})
          </p>
        )}
      </div>

      {valuationType === "promocion" && (
        <div className="w-full max-w-xs">
          <Label htmlFor="custom_price">Precio de promoción (por unidad)</Label>
          <Input
            id="custom_price"
            name="custom_price"
            type="number"
            min={0.01}
            step="0.01"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            required
          />
        </div>
      )}

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
