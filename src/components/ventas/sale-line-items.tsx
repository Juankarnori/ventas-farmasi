"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";

export interface SellableProduct {
  id: string;
  name: string;
  sale_price: number;
  stock: number;
}

interface Row {
  key: number;
  product_id: string;
  quantity: number;
  sale_price: number;
}

export function SaleLineItems({ products }: { products: SellableProduct[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    products.length > 0
      ? [{ key: 0, product_id: products[0].id, quantity: 1, sale_price: products[0].sale_price }]
      : [],
  );
  const [nextKey, setNextKey] = useState(1);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function addRow() {
    if (products.length === 0) return;
    setRows((r) => [
      ...r,
      { key: nextKey, product_id: products[0].id, quantity: 1, sale_price: products[0].sale_price },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const total = rows.reduce((sum, r) => sum + r.quantity * r.sale_price, 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.product_id && r.quantity > 0)
      .map((r) => ({ product_id: r.product_id, quantity: r.quantity, sale_price: r.sale_price })),
  );

  if (products.length === 0) {
    return <p className="text-sm text-ink/60">No hay productos con stock disponible.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="items" value={itemsJson} />

      {rows.map((row) => {
        const product = productById.get(row.product_id);
        const overStock = !!product && row.quantity > product.stock;

        return (
          <div key={row.key} className="rounded-lg border border-ink/10 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1">
                <Select
                  value={row.product_id}
                  onChange={(e) => {
                    const p = productById.get(e.target.value);
                    updateRow(row.key, {
                      product_id: e.target.value,
                      sale_price: p?.sale_price ?? row.sale_price,
                    });
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stock} en stock)
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
                className="rounded-full p-2 text-ink/40 hover:bg-accent/10 hover:text-accent"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {overStock && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                <AlertTriangle className="h-3.5 w-3.5" /> Solo hay {product?.stock} en stock
              </p>
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
