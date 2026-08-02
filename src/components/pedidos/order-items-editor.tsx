"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";

export interface OrderableProduct {
  id: string;
  name: string;
  cost_price: number;
}

interface Row {
  key: number;
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export function OrderItemsEditor({ products }: { products: OrderableProduct[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    products.length > 0
      ? [{ key: 0, product_id: products[0].id, quantity: 1, unit_cost: products[0].cost_price }]
      : [],
  );
  const [nextKey, setNextKey] = useState(1);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function addRow() {
    if (products.length === 0) return;
    setRows((r) => [
      ...r,
      { key: nextKey, product_id: products[0].id, quantity: 1, unit_cost: products[0].cost_price },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const total = rows.reduce((sum, r) => sum + r.quantity * r.unit_cost, 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.product_id && r.quantity > 0)
      .map((r) => ({ product_id: r.product_id, quantity: r.quantity, unit_cost: r.unit_cost })),
  );

  if (products.length === 0) {
    return <p className="text-sm text-ink/60">Agregá productos al catálogo antes de crear un pedido.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="items" value={itemsJson} />

      {rows.map((row) => (
        <div key={row.key} className="flex flex-wrap items-end gap-2 rounded-lg border border-ink/10 p-3">
          <div className="min-w-[180px] flex-1">
            <Select
              value={row.product_id}
              onChange={(e) => {
                const product = productById.get(e.target.value);
                updateRow(row.key, {
                  product_id: e.target.value,
                  unit_cost: product?.cost_price ?? row.unit_cost,
                });
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
      ))}

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
