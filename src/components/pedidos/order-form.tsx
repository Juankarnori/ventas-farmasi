import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderItemsEditor, type OrderableProduct, type OrderItemDefault } from "./order-items-editor";
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
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="w-48">
        <Label htmlFor="order_date">Fecha</Label>
        <Input id="order_date" name="order_date" type="date" defaultValue={todayISO()} required />
      </div>

      <OrderItemsEditor products={products} categories={categories} lines={lines} defaultItems={defaultItems} />

      <Button type="submit" disabled={products.length === 0}>
        Crear pedido
      </Button>
    </form>
  );
}
