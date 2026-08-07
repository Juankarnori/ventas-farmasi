"use client";

import { useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { SaleLineItems, type SellableProduct, type SaleItemDefault } from "./sale-line-items";

export interface ApartadoItemDisplayRow {
  id: string;
  label: string;
  quantity: number;
  salePrice: number;
  delivered: boolean;
  // Ya renderizado desde la página (el "Marcar entregado"/"Entregado" de
  // cada renglón, con su form action ya bindeado al id real) — se pasa
  // como nodo, no como función: una función arbitraria no se puede cruzar
  // del server component de la página a este client component, solo
  // elementos ya armados o server actions.
  deliveryControl: React.ReactNode;
}

// Edición de los productos/cantidades de un apartado — mismo patrón
// vista/edición+confirmación que SaleEditPanel, pero:
// - solo se ofrece si nada del apartado se entregó todavía (ver
//   update_apartado_items: si algo ya se entregó, el guardado se rechaza
//   igual del lado del servidor, así que ni se muestra el botón acá)
// - el servidor bloquea si el nuevo total queda por debajo de lo ya
//   abonado; ese error se muestra en la pantalla de error genérica de la
//   app (mismo mecanismo que ya usa el resto de las ediciones riesgosas).
export function ApartadoItemsEditPanel({
  displayRows,
  totalPrice,
  canEdit,
  defaultItems,
  products,
  categories,
  lines,
  action,
}: {
  displayRows: ApartadoItemDisplayRow[];
  totalPrice: number;
  canEdit: boolean;
  defaultItems: SaleItemDefault[];
  products: SellableProduct[];
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
      e.preventDefault();
      setConfirmOpen(true);
    }
  }

  function confirmAndSubmit() {
    setConfirmOpen(false);
    skipConfirmRef.current = true;
    formRef.current?.requestSubmit();
  }

  if (!editing) {
    return (
      <Card className="mt-6 p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Productos apartados</CardTitle>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar productos
            </button>
          )}
        </CardHeader>
        <Table>
          <Thead>
            <Tr>
              <Th>Producto</Th>
              <Th className="text-right">Cant.</Th>
              <Th className="text-right">Precio</Th>
              <Th>Entrega</Th>
            </Tr>
          </Thead>
          <Tbody>
            {displayRows.map((row) => (
              <Tr key={row.id}>
                <Td>{row.label}</Td>
                <Td numeric>{row.quantity}</Td>
                <Td numeric>{formatCurrency(row.salePrice)}</Td>
                <Td>{row.deliveryControl}</Td>
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

  return (
    <>
      <Card className="mt-6">
        <form ref={formRef} action={action} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <SaleLineItems products={products} categories={categories} lines={lines} defaultItems={defaultItems} />
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
            Estás por quitar un producto o reducir alguna cantidad del apartado — esa diferencia de
            stock se te devuelve al guardar. Si el nuevo total queda por debajo de lo que la clienta ya
            abonó, el guardado se va a rechazar. Esta acción no se puede deshacer.
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
