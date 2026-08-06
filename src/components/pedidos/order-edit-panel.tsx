"use client";

import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  headerRight,
  footerNote,
}: {
  displayRows: OrderDisplayRow[];
  totalCost: number;
  headerRight?: React.ReactNode;
  footerNote?: React.ReactNode;
}) {
  const totalUnits = displayRows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <Card className="mt-6 p-0">
      {headerRight && <div className="flex justify-end px-5 pt-5">{headerRight}</div>}
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
      <p className="border-t border-ink/10 px-5 py-3 text-right text-sm text-ink/60">
        {totalUnits} producto{totalUnits === 1 ? "" : "s"} · Total del pedido:{" "}
        <span className="font-mono text-base tabular-nums text-ink">
          {formatCurrency(totalCost)}
        </span>
      </p>
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
  defaultItems,
  products,
  categories,
  lines,
  action,
}: {
  isPending: boolean;
  displayRows: OrderDisplayRow[];
  totalCost: number;
  defaultItems: OrderItemDefault[];
  products: OrderableProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const skipConfirmRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (skipConfirmRef.current) {
      skipConfirmRef.current = false;
      return;
    }

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
      e.preventDefault();
      setConfirmOpen(true);
    }
  }

  function confirmAndSubmit() {
    setConfirmOpen(false);
    skipConfirmRef.current = true;
    formRef.current?.requestSubmit();
  }

  if (!isPending) {
    return (
      <ReadOnlyItems
        displayRows={displayRows}
        totalCost={totalCost}
        footerNote="Ya fue recibido — no se puede editar. Si faltó o sobró algo, hacé un ajuste manual desde Inventario."
      />
    );
  }

  if (!editing) {
    return (
      <ReadOnlyItems
        displayRows={displayRows}
        totalCost={totalCost}
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
        <form ref={formRef} action={action} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <OrderItemsEditor
            products={products}
            categories={categories}
            lines={lines}
            defaultItems={defaultItems}
          />
          <div className="flex gap-2">
            <Button type="submit">Guardar cambios</Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
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
