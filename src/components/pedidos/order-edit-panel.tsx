"use client";

import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { OrderItemsEditor, type OrderableProduct, type OrderItemDefault } from "./order-items-editor";

export interface OrderDisplayRow {
  id: string; // id del order_item — solo para key de React, no necesariamente único por variante
  variantId: string;
  label: string;
  quantity: number;
  unitCost: number;
}

function ReadOnlyItems({
  displayRows,
  totalCost,
  farmasiOrderNumber,
  giftCardAmount,
  headerRight,
  footerNote,
}: {
  displayRows: OrderDisplayRow[];
  totalCost: number;
  farmasiOrderNumber: string | null;
  giftCardAmount: number;
  headerRight?: React.ReactNode;
  footerNote?: React.ReactNode;
}) {
  const totalUnits = displayRows.reduce((sum, r) => sum + r.quantity, 0);
  const totalToPay = Math.max(0, totalCost - giftCardAmount);

  return (
    <Card className="mt-6 p-0">
      {(farmasiOrderNumber || headerRight) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          {farmasiOrderNumber ? (
            <p className="text-xs text-ink/50">N° de orden Farmasi: {farmasiOrderNumber}</p>
          ) : (
            <span />
          )}
          {headerRight}
        </div>
      )}
      <Table>
        <Thead>
          <Tr>
            <Th className="pl-5">Producto</Th>
            <Th className="text-right">Cantidad</Th>
            <Th className="pr-5 text-right">Costo unitario</Th>
          </Tr>
        </Thead>
        <Tbody>
          {displayRows.map((row) => (
            <Tr key={row.id}>
              <Td className="pl-5">{row.label}</Td>
              <Td numeric>{row.quantity}</Td>
              <Td numeric className="pr-5">
                {formatCurrency(row.unitCost)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <div className="border-t border-ink/10 px-5 py-3 text-right text-sm text-ink/60">
        <p>
          {totalUnits} producto{totalUnits === 1 ? "" : "s"} · Total del pedido:{" "}
          <span className="font-mono text-base tabular-nums text-ink">
            {formatCurrency(totalCost)}
          </span>
        </p>
        {giftCardAmount > 0 && (
          <p className="mt-1">
            Bono: −{formatCurrency(giftCardAmount)} · Total a pagar:{" "}
            <span className="font-mono text-base tabular-nums font-semibold text-ink">
              {formatCurrency(totalToPay)}
            </span>
          </p>
        )}
      </div>
      {footerNote && (
        <p className="border-t border-ink/10 px-5 py-3 text-xs text-ink/50">{footerNote}</p>
      )}
    </Card>
  );
}

export function OrderEditPanel({
  isPending,
  displayRows,
  totalCost,
  farmasiOrderNumber,
  giftCardAmount,
  defaultItems,
  products,
  categories,
  lines,
  action,
}: {
  isPending: boolean;
  displayRows: OrderDisplayRow[];
  totalCost: number;
  farmasiOrderNumber: string | null;
  giftCardAmount: number;
  defaultItems: OrderItemDefault[];
  products: OrderableProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  action: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingFormData = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [itemsTotal, setItemsTotal] = useState(totalCost);
  const [giftCardInput, setGiftCardInput] = useState(giftCardAmount > 0 ? String(giftCardAmount) : "");
  const giftCardNumber = Number(giftCardInput) || 0;
  const totalToPay = Math.max(0, itemsTotal - giftCardNumber);

  // La Server Action devuelve { error? } en vez de tirar una excepción —
  // en producción, Next.js oculta el mensaje real de cualquier throw no
  // atrapado en una Server Action (lo reemplaza por un texto genérico +
  // digest), así que el único jeito confiable de mostrar el motivo real
  // es que nunca se lance como excepción para empezar.
  async function doSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    let nextItems: { variant_id: string; quantity: number }[] = [];
    try {
      nextItems = JSON.parse(String(formData.get("items") ?? "[]"));
    } catch {
      return;
    }

    const nextQtyByVariant = new Map(nextItems.map((i) => [i.variant_id, i.quantity]));
    const removedOrReduced = defaultItems.some((original) => {
      const nextQty = nextQtyByVariant.get(original.variant_id) ?? 0;
      return nextQty < original.quantity;
    });

    if (removedOrReduced) {
      pendingFormData.current = formData;
      setConfirmOpen(true);
      return;
    }

    void doSubmit(formData);
  }

  function confirmAndSubmit() {
    setConfirmOpen(false);
    if (pendingFormData.current) void doSubmit(pendingFormData.current);
  }

  if (!isPending) {
    return (
      <ReadOnlyItems
        displayRows={displayRows}
        totalCost={totalCost}
        farmasiOrderNumber={farmasiOrderNumber}
        giftCardAmount={giftCardAmount}
        footerNote="Ya fue recibido — no se puede editar. Si faltó o sobró algo, hacé un ajuste manual desde Inventario."
      />
    );
  }

  if (!editing) {
    return (
      <ReadOnlyItems
        displayRows={displayRows}
        totalCost={totalCost}
        farmasiOrderNumber={farmasiOrderNumber}
        giftCardAmount={giftCardAmount}
        headerRight={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar pedido
          </button>
        }
      />
    );
  }

  return (
    <>
      <Card className="mt-6">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="farmasi_order_number">N° de orden Farmasi (opcional)</Label>
            <Input
              id="farmasi_order_number"
              name="farmasi_order_number"
              defaultValue={farmasiOrderNumber ?? ""}
              placeholder="Ej: 123456789"
            />
          </div>

          <OrderItemsEditor
            products={products}
            categories={categories}
            lines={lines}
            defaultItems={defaultItems}
            onTotalChange={setItemsTotal}
          />

          <div className="w-48">
            <Label htmlFor="gift_card_amount">Tarjeta de regalo / bono (opcional)</Label>
            <Input
              id="gift_card_amount"
              name="gift_card_amount"
              type="number"
              min={0}
              step="0.01"
              value={giftCardInput}
              onChange={(e) => setGiftCardInput(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {giftCardNumber > 0 && (
            <p className="text-sm text-ink/60">
              Total: {formatCurrency(itemsTotal)} − Bono: {formatCurrency(giftCardNumber)} = Total a
              pagar: <span className="font-semibold text-ink">{formatCurrency(totalToPay)}</span>
            </p>
          )}

          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando..." : "Guardar cambios"}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>
        </form>
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="¿Confirmar cambios?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Estás por quitar un producto o reducir alguna cantidad del pedido. Esta acción no se
            puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Volver
            </Button>
            <Button type="button" variant="outline" onClick={confirmAndSubmit}>
              Sí, guardar cambios
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
