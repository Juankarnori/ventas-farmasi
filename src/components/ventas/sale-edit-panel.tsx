"use client";

import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { SaleLineItems, type SellableProduct, type SaleItemDefault } from "./sale-line-items";
import { PaymentMethodField } from "./payment-method-field";
import type { PaymentMethod } from "@/lib/types/database.types";

export interface SaleDisplayRow {
  id: string;
  label: string;
  quantity: number;
  salePrice: number;
}

function PaymentBadge({ paymentMethod, bankNote }: { paymentMethod: PaymentMethod; bankNote: string | null }) {
  return (
    <Badge variant={paymentMethod === "transferencia" ? "sage" : "gold"}>
      {paymentMethod === "transferencia" ? "🏦 Transferencia" : "💵 Efectivo"}
      {bankNote && ` · ${bankNote}`}
    </Badge>
  );
}

function ReadOnlyItems({
  displayRows,
  totalPrice,
  paymentMethod,
  bankNote,
  headerRight,
}: {
  displayRows: SaleDisplayRow[];
  totalPrice: number;
  paymentMethod: PaymentMethod;
  bankNote: string | null;
  headerRight?: React.ReactNode;
}) {
  return (
    <Card className="mt-6 p-0">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <PaymentBadge paymentMethod={paymentMethod} bankNote={bankNote} />
        {headerRight}
      </div>
      <Table>
        <Thead>
          <Tr>
            <Th className="pl-5">Producto</Th>
            <Th className="text-right">Cantidad</Th>
            <Th className="pr-5 text-right">Precio</Th>
          </Tr>
        </Thead>
        <Tbody>
          {displayRows.map((row) => (
            <Tr key={row.id}>
              <Td className="pl-5">{row.label}</Td>
              <Td numeric>{row.quantity}</Td>
              <Td numeric className="pr-5">
                {formatCurrency(row.salePrice)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <p className="border-t border-ink/10 px-5 py-3 text-right text-sm text-ink/60">
        Total:{" "}
        <span className="font-mono text-base tabular-nums text-ink">{formatCurrency(totalPrice)}</span>
      </p>
    </Card>
  );
}

export function SaleEditPanel({
  displayRows,
  totalPrice,
  paymentMethod,
  bankNote,
  defaultItems,
  products,
  categories,
  lines,
  action,
}: {
  displayRows: SaleDisplayRow[];
  totalPrice: number;
  paymentMethod: PaymentMethod;
  bankNote: string | null;
  defaultItems: SaleItemDefault[];
  products: SellableProduct[];
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

  async function doSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await action(formData);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  }

  // El stock ya se descontó al crear esta venta (a diferencia de un
  // pedido pendiente) — bajar una cantidad o quitar un producto le
  // devuelve stock a la vendedora, así que amerita el mismo aviso previo
  // que ya usamos al editar un pedido.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    let nextItems: { variant_id: string; quantity: number }[] = [];
    try {
      nextItems = JSON.parse(String(formData.get("items") ?? "[]"));
    } catch {
      return;
    }

    const nextQtyByVariant = new Map<string, number>();
    for (const i of nextItems) {
      nextQtyByVariant.set(i.variant_id, (nextQtyByVariant.get(i.variant_id) ?? 0) + i.quantity);
    }

    const oldQtyByVariant = new Map<string, number>();
    for (const i of defaultItems) {
      oldQtyByVariant.set(i.variant_id, (oldQtyByVariant.get(i.variant_id) ?? 0) + i.quantity);
    }

    const removedOrReduced = Array.from(oldQtyByVariant.entries()).some(
      ([variantId, oldQty]) => (nextQtyByVariant.get(variantId) ?? 0) < oldQty,
    );

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

  if (!editing) {
    return (
      <ReadOnlyItems
        displayRows={displayRows}
        totalPrice={totalPrice}
        paymentMethod={paymentMethod}
        bankNote={bankNote}
        headerRight={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar venta
          </button>
        }
      />
    );
  }

  return (
    <>
      <Card className="mt-6">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PaymentMethodField defaultMethod={paymentMethod} defaultBankNote={bankNote} />
          <SaleLineItems
            products={products}
            categories={categories}
            lines={lines}
            defaultItems={defaultItems}
          />
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
            Estás por quitar un producto o reducir alguna cantidad de la venta — esa diferencia de
            stock se te devuelve al guardar. Esta acción no se puede deshacer.
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
