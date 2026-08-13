"use client";

import { useState } from "react";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderItemsEditor, type OrderableProduct, type OrderItemDefault } from "./order-items-editor";
import { formatCurrency } from "@/lib/utils/currency";
import { todayISO } from "@/lib/utils/date";

export function OrderForm({
  products,
  categories,
  lines,
  action,
  defaultItems,
}: {
  products: OrderableProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  action: (formData: FormData) => void | Promise<void>;
  // Precarga desde "Crear pedido" en una venta que se quedó sin stock (ver
  // CreateOrderLink) — arranca el pedido ya con ese producto/color/
  // cantidad en vez de una fila vacía.
  defaultItems?: OrderItemDefault[];
}) {
  // Solo para el desglose "Total − Bono = Total a pagar" en vivo — lo que
  // de verdad se guarda es gift_card_amount (el bono) más los renglones
  // de siempre; total_cost - gift_card_amount se recalcula en pantalla
  // en cualquier lugar que lo necesite mostrar, nunca se persiste aparte.
  const [itemsTotal, setItemsTotal] = useState(0);
  const [giftCardAmount, setGiftCardAmount] = useState("");
  const giftCardNumber = Number(giftCardAmount) || 0;
  const totalToPay = Math.max(0, itemsTotal - giftCardNumber);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="w-48">
        <Label htmlFor="order_date">Fecha</Label>
        <Input id="order_date" name="order_date" type="date" defaultValue={todayISO()} required />
      </div>

      <div>
        <Label htmlFor="farmasi_order_number">N° de orden Farmasi (opcional)</Label>
        <Input id="farmasi_order_number" name="farmasi_order_number" placeholder="Ej: 123456789" />
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
          value={giftCardAmount}
          onChange={(e) => setGiftCardAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      {giftCardNumber > 0 && (
        <p className="text-sm text-ink/60">
          Total: {formatCurrency(itemsTotal)} − Bono: {formatCurrency(giftCardNumber)} = Total a
          pagar: <span className="font-semibold text-ink">{formatCurrency(totalToPay)}</span>
        </p>
      )}

      <Button type="submit" disabled={products.length === 0}>
        Crear pedido
      </Button>
    </form>
  );
}
