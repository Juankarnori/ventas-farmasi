import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderItemsEditor, type OrderableProduct } from "./order-items-editor";
import { todayISO } from "@/lib/utils/date";

export function OrderForm({
  products,
  action,
}: {
  products: OrderableProduct[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="w-48">
        <Label htmlFor="order_date">Fecha</Label>
        <Input id="order_date" name="order_date" type="date" defaultValue={todayISO()} required />
      </div>

      <OrderItemsEditor products={products} />

      <Button type="submit" disabled={products.length === 0}>
        Crear pedido
      </Button>
    </form>
  );
}
