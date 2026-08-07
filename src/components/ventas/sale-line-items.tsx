"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";
import { BorrowStockDialog } from "./borrow-stock-dialog";

export interface SellableVariant {
  id: string;
  color_name: string;
  stock: number;
  price_override: number | null;
}

export interface SellableProduct {
  id: string;
  name: string;
  sale_price: number;
  category_id: string | null;
  line_id: string | null;
  variants: SellableVariant[];
}

interface Row {
  key: number;
  product_id: string;
  variant_id: string;
  quantity: number;
  sale_price: number;
}

export interface SaleItemDefault {
  product_id: string;
  variant_id: string;
  quantity: number;
  sale_price: number;
}

function effectivePrice(product: SellableProduct, variant: SellableVariant) {
  return variant.price_override ?? product.sale_price;
}

export function SaleLineItems({
  products,
  categories,
  lines,
  defaultItems,
}: {
  products: SellableProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  // Para editar una venta existente: precarga los renglones tal cual
  // estaban guardados en vez de arrancar con una sola fila vacía. El
  // stock mostrado por cada variante (product.variants[].stock) ya tiene
  // que venir ajustado por quien arma `products` — sumándole de vuelta lo
  // que esta misma venta ya tenía de esa variante — para no mostrar un
  // "no te alcanza" falso sobre una cantidad que en realidad ya es tuya.
  defaultItems?: SaleItemDefault[];
}) {
  // Copia local mutable: cuando se pide prestado stock desde acá mismo
  // (ver BorrowStockDialog), el préstamo ya se creó de verdad en la base
  // — esto solo refleja ese cambio en pantalla al toque, sin recargar la
  // página ni perder lo que ya se había cargado en el formulario.
  const [productsState, setProductsState] = useState(products);
  const productById = useMemo(() => new Map(productsState.map((p) => [p.id, p])), [productsState]);

  function bumpStock(variantId: string, addedStock: number) {
    setProductsState((prev) =>
      prev.map((p) => ({
        ...p,
        variants: p.variants.map((v) => (v.id === variantId ? { ...v, stock: v.stock + addedStock } : v)),
      })),
    );
  }

  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterLineId, setFilterLineId] = useState("");

  const filteredProducts = useMemo(
    () =>
      productsState.filter((p) => {
        if (filterCategoryId && p.category_id !== filterCategoryId) return false;
        if (filterLineId && p.line_id !== filterLineId) return false;
        return true;
      }),
    [productsState, filterCategoryId, filterLineId],
  );

  function onFilterCategoryChange(id: string) {
    setFilterCategoryId(id);
    setFilterLineId("");
  }

  // Las opciones del select de un renglón son la lista filtrada, más su
  // propio producto ya elegido si el filtro cambió después y ya no lo
  // incluye (para no romper una fila que ya estaba armada).
  function optionsFor(productId: string) {
    if (filteredProducts.length === 0 || filteredProducts.some((p) => p.id === productId)) {
      return filteredProducts;
    }
    const current = productById.get(productId);
    return current ? [current, ...filteredProducts] : filteredProducts;
  }

  function firstRowFor(product: SellableProduct): Omit<Row, "key"> {
    const variant = product.variants[0];
    return {
      product_id: product.id,
      variant_id: variant.id,
      quantity: 1,
      sale_price: effectivePrice(product, variant),
    };
  }

  const [rows, setRows] = useState<Row[]>(() => {
    if (defaultItems && defaultItems.length > 0) {
      return defaultItems.map((item, i) => ({ key: i, ...item }));
    }
    return products.length > 0 ? [{ key: 0, ...firstRowFor(products[0]) }] : [];
  });
  const [nextKey, setNextKey] = useState(() =>
    defaultItems && defaultItems.length > 0 ? defaultItems.length : 1,
  );

  function addRow() {
    const pool = filteredProducts.length > 0 ? filteredProducts : productsState;
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
      sale_price: effectivePrice(product, variant),
    });
  }

  function onVariantChange(key: number, productId: string, variantId: string) {
    const product = productById.get(productId);
    const variant = product?.variants.find((v) => v.id === variantId);
    if (!product || !variant) return;
    updateRow(key, { variant_id: variantId, sale_price: effectivePrice(product, variant) });
  }

  const total = rows.reduce((sum, r) => sum + r.quantity * r.sale_price, 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.variant_id && r.quantity > 0)
      .map((r) => ({ variant_id: r.variant_id, quantity: r.quantity, sale_price: r.sale_price })),
  );

  if (products.length === 0) {
    return <p className="text-sm text-ink/60">No hay productos con variantes disponibles.</p>;
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
      />

      {rows.map((row) => {
        const product = productById.get(row.product_id);
        const variant = product?.variants.find((v) => v.id === row.variant_id);
        const overStock = !!variant && row.quantity > variant.stock;

        return (
          <div key={row.key} className="rounded-lg border border-ink/10 p-3">
            <div className="flex flex-wrap items-end gap-2">
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
              <div className="min-w-[160px] flex-1">
                <Select
                  aria-label="Color"
                  value={row.variant_id}
                  onChange={(e) => onVariantChange(row.key, row.product_id, e.target.value)}
                >
                  {product?.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.color_name} (tenés {v.stock})
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
                  value={row.sale_price}
                  onChange={(e) => updateRow(row.key, { sale_price: Number(e.target.value) })}
                  aria-label="Precio de venta"
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
            {overStock && (
              <div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-ink">
                  <AlertTriangle className="h-3.5 w-3.5 text-accent" /> Solo tenés {variant?.stock} de
                  stock propio de este color.
                </p>
                <BorrowStockDialog
                  variantId={row.variant_id}
                  missingQuantity={row.quantity - (variant?.stock ?? 0)}
                  onBorrowed={(added) => bumpStock(row.variant_id, added)}
                />
              </div>
            )}
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
