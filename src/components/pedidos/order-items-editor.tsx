"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";
import { QuickAddByCode } from "@/components/shared/quick-add-by-code";
import { filterProducts } from "@/lib/utils/product-search";

export interface OrderableVariant {
  id: string;
  color_name: string;
  cost_override: number | null;
  sku: string | null;
}

export interface OrderableProduct {
  id: string;
  name: string;
  cost_price: number;
  category_id: string | null;
  line_id: string | null;
  variants: OrderableVariant[];
}

interface Row {
  key: number;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_cost: number;
}

export interface OrderItemDefault {
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_cost: number;
}

function effectiveCost(product: OrderableProduct, variant: OrderableVariant) {
  return variant.cost_override ?? product.cost_price;
}

export function OrderItemsEditor({
  products,
  categories,
  lines,
  defaultItems,
}: {
  products: OrderableProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  defaultItems?: OrderItemDefault[];
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

  function optionsFor(productId: string) {
    if (filteredProducts.length === 0 || filteredProducts.some((p) => p.id === productId)) {
      return filteredProducts;
    }
    const current = productById.get(productId);
    return current ? [current, ...filteredProducts] : filteredProducts;
  }

  function firstRowFor(product: OrderableProduct): Omit<Row, "key"> {
    const variant = product.variants[0];
    return {
      product_id: product.id,
      variant_id: variant.id,
      quantity: 1,
      unit_cost: effectiveCost(product, variant),
    };
  }

  const [rows, setRows] = useState<Row[]>(() => {
    if (defaultItems && defaultItems.length > 0) {
      return defaultItems.map((item, i) => ({ key: i, ...item }));
    }
    return products.length > 0 ? [{ key: 0, ...firstRowFor(products[0]) }] : [];
  });
  const [nextKey, setNextKey] = useState(() => (defaultItems && defaultItems.length > 0 ? defaultItems.length : 1));

  function addRow() {
    const pool = filteredProducts.length > 0 ? filteredProducts : products;
    if (pool.length === 0) return;
    setRows((r) => [...r, { key: nextKey, ...firstRowFor(pool[0]) }]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function onProductChange(key: number, productId: string) {
    const product = productById.get(productId);
    if (!product) return;
    const variant = product.variants[0];
    updateRow(key, {
      product_id: productId,
      variant_id: variant.id,
      unit_cost: effectiveCost(product, variant),
    });
  }

  function onVariantChange(key: number, productId: string, variantId: string) {
    const product = productById.get(productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) return;
    updateRow(key, { variant_id: variantId, unit_cost: effectiveCost(product, variant) });
  }

  // Atajo de "agregar por código": si esa variante ya está en la lista,
  // suma 1 en vez de duplicar la fila.
  function onQuickAdd(productId: string, variantId: string) {
    const product = productById.get(productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) return;

    const existing = rows.find((r) => r.variant_id === variantId);
    if (existing) {
      updateRow(existing.key, { quantity: existing.quantity + 1 });
      return;
    }

    setRows((r) => [
      ...r,
      { key: nextKey, product_id: productId, variant_id: variantId, quantity: 1, unit_cost: effectiveCost(product, variant) },
    ]);
    setNextKey((k) => k + 1);
  }

  const total = rows.reduce((sum, r) => sum + r.quantity * r.unit_cost, 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.variant_id && r.quantity > 0)
      .map((r) => ({ variant_id: r.variant_id, quantity: r.quantity, unit_cost: r.unit_cost })),
  );

  if (products.length === 0) {
    return <p className="text-sm text-ink/60">Agregá productos al catálogo antes de crear un pedido.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="items" value={itemsJson} />

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

      <QuickAddByCode products={products} onFound={onQuickAdd} />

      {rows.map((row) => {
        const product = productById.get(row.product_id);

        return (
          <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-lg border border-ink/10 p-3">
            <div className="min-w-[160px] flex-1">
              <Select
                aria-label="Producto"
                value={row.product_id}
                onChange={(e) => onProductChange(row.key, e.target.value)}
              >
                {optionsFor(row.product_id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[140px] flex-1">
              <Select
                aria-label="Color"
                value={row.variant_id}
                onChange={(e) => onVariantChange(row.key, row.product_id, e.target.value)}
              >
                {product?.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.color_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-24">
              <Input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) })}
                aria-label="Cantidad"
              />
            </div>
            <div className="w-32">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.unit_cost}
                onChange={(e) => updateRow(row.key, { unit_cost: Number(e.target.value) })}
                aria-label="Costo unitario"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label="Quitar producto"
              className="rounded-full p-2 text-ink/40 hover:bg-accent/20 hover:text-ink"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar producto
      </button>

      <p className="text-right text-sm text-ink/60">
        Total: <span className="font-mono tabular-nums text-ink">{formatCurrency(total)}</span>
      </p>
    </div>
  );
}
