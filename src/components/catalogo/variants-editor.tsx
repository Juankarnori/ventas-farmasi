"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";

export interface VariantDefault {
  id: string;
  color_name: string;
  color_hex: string | null;
  myStock: number;
  otherStock: number;
  otherName: string;
  price_override: number | null;
  cost_override: number | null;
  image_url: string | null;
}

interface VariantRow {
  key: number;
  id?: string;
  color_name: string;
  useCustomColor: boolean;
  color_hex: string;
  stock: number;
  otherStock?: number;
  otherName?: string;
  useDifferentPrice: boolean;
  price_override: number;
  useDifferentCost: boolean;
  cost_override: number;
  useDifferentImage: boolean;
  image_url: string;
}

function rowsFromDefaults(defaults?: VariantDefault[]): VariantRow[] {
  if (!defaults || defaults.length === 0) {
    return [
      {
        key: 0,
        color_name: "Único",
        useCustomColor: false,
        color_hex: "#5F8FB8",
        stock: 0,
        useDifferentPrice: false,
        price_override: 0,
        useDifferentCost: false,
        cost_override: 0,
        useDifferentImage: false,
        image_url: "",
      },
    ];
  }

  return defaults.map((v, i) => ({
    key: i,
    id: v.id,
    color_name: v.color_name,
    useCustomColor: !!v.color_hex,
    color_hex: v.color_hex ?? "#5F8FB8",
    stock: v.myStock,
    otherStock: v.otherStock,
    otherName: v.otherName,
    useDifferentPrice: v.price_override !== null,
    price_override: v.price_override ?? 0,
    useDifferentCost: v.cost_override !== null,
    cost_override: v.cost_override ?? 0,
    useDifferentImage: !!v.image_url,
    image_url: v.image_url ?? "",
  }));
}

export function VariantsEditor({ defaultVariants }: { defaultVariants?: VariantDefault[] }) {
  const [rows, setRows] = useState<VariantRow[]>(() => rowsFromDefaults(defaultVariants));
  const [nextKey, setNextKey] = useState(() => rows.length);

  function addRow() {
    setRows((r) => [
      ...r,
      {
        key: nextKey,
        color_name: "",
        useCustomColor: false,
        color_hex: "#5F8FB8",
        stock: 0,
        useDifferentPrice: false,
        price_override: 0,
        useDifferentCost: false,
        cost_override: 0,
        useDifferentImage: false,
        image_url: "",
      },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }

  function updateRow(key: number, patch: Partial<VariantRow>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const variantsJson = JSON.stringify(
    rows.map((r) => ({
      id: r.id ?? null,
      color_name: r.color_name.trim() || "Único",
      color_hex: r.useCustomColor ? r.color_hex : null,
      stock: r.stock,
      price_override: r.useDifferentPrice ? r.price_override : null,
      cost_override: r.useDifferentCost ? r.cost_override : null,
      image_url: r.useDifferentImage ? r.image_url || null : null,
    })),
  );

  return (
    <div>
      <Label>Variantes de color</Label>
      <input type="hidden" name="variants" value={variantsJson} />

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-3 rounded-lg border border-ink/10 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1">
                <Label htmlFor={`color-name-${row.key}`}>Color</Label>
                <Input
                  id={`color-name-${row.key}`}
                  value={row.color_name}
                  onChange={(e) => updateRow(row.key, { color_name: e.target.value })}
                  placeholder="Único"
                />
              </div>
              <div className="w-28">
                <Label htmlFor={`stock-${row.key}`}>
                  {row.id ? "Tu stock" : "Tu stock inicial"}
                </Label>
                <Input
                  id={`stock-${row.key}`}
                  type="number"
                  min={0}
                  value={row.stock}
                  onChange={(e) => updateRow(row.key, { stock: Number(e.target.value) })}
                />
                {row.otherStock !== undefined && (
                  <p className="mt-1 text-[11px] text-ink/50">
                    {row.otherName}: {row.otherStock} · Total: {row.stock + row.otherStock}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-xs text-ink/60">
                <input
                  type="checkbox"
                  checked={row.useCustomColor}
                  onChange={(e) => updateRow(row.key, { useCustomColor: e.target.checked })}
                />
                Color personalizado
              </label>
              {row.useCustomColor && (
                <input
                  type="color"
                  value={row.color_hex}
                  onChange={(e) => updateRow(row.key, { color_hex: e.target.value })}
                  className="h-9 w-12 rounded-lg border border-ink/15 bg-white/80 p-1"
                  aria-label="Color personalizado"
                />
              )}
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                aria-label="Quitar variante"
                className="ml-auto rounded-full p-2 text-ink/40 hover:bg-accent/20 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-ink/60">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={row.useDifferentPrice}
                  onChange={(e) => updateRow(row.key, { useDifferentPrice: e.target.checked })}
                />
                Precio distinto
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={row.useDifferentCost}
                  onChange={(e) => updateRow(row.key, { useDifferentCost: e.target.checked })}
                />
                Costo distinto
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={row.useDifferentImage}
                  onChange={(e) => updateRow(row.key, { useDifferentImage: e.target.checked })}
                />
                Imagen distinta
              </label>
            </div>

            {(row.useDifferentPrice || row.useDifferentCost || row.useDifferentImage) && (
              <div className="flex flex-wrap gap-2">
                {row.useDifferentPrice && (
                  <div className="w-32">
                    <Label htmlFor={`price-${row.key}`}>Precio de venta</Label>
                    <Input
                      id={`price-${row.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.price_override}
                      onChange={(e) =>
                        updateRow(row.key, { price_override: Number(e.target.value) })
                      }
                    />
                  </div>
                )}
                {row.useDifferentCost && (
                  <div className="w-32">
                    <Label htmlFor={`cost-${row.key}`}>Costo</Label>
                    <Input
                      id={`cost-${row.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.cost_override}
                      onChange={(e) =>
                        updateRow(row.key, { cost_override: Number(e.target.value) })
                      }
                    />
                  </div>
                )}
                {row.useDifferentImage && (
                  <div className="min-w-[200px] flex-1">
                    <Label htmlFor={`image-${row.key}`}>URL de imagen</Label>
                    <Input
                      id={`image-${row.key}`}
                      value={row.image_url}
                      onChange={(e) => updateRow(row.key, { image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar color
      </button>
    </div>
  );
}
