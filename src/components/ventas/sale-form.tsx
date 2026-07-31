import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SaleLineItems, type SellableProduct } from "./sale-line-items";
import { todayISO } from "@/lib/utils/date";

export function SaleForm({
  products,
  action,
}: {
  products: SellableProduct[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Label htmlFor="sale_date">Fecha</Label>
          <Input id="sale_date" name="sale_date" type="date" defaultValue={todayISO()} required />
        </div>
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="customer_name">Cliente (opcional)</Label>
          <Input id="customer_name" name="customer_name" placeholder="Nombre de la clienta" />
        </div>
      </div>

      <SaleLineItems products={products} />

      <Button type="submit" disabled={products.length === 0}>
        Registrar venta
      </Button>
    </form>
  );
}
