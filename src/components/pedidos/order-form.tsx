import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderItemsEditor, type OrderableProduct } from "./order-items-editor";
import { todayISO } from "@/lib/utils/date";

export function OrderForm({
  products,
  categories,
  lines,
  action,
}: {
  products: OrderableProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="w-48">
        <Label htmlFor="order_date">Fecha</Label>
        <Input id="order_date" name="order_date" type="date" defaultValue={todayISO()} required />
      </div>

      <OrderItemsEditor products={products} categories={categories} lines={lines} />

      <Button type="submit" disabled={products.length === 0}>
        Crear pedido
      </Button>
    </form>
  );
}
