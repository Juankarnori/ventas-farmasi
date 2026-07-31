import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SaleForm } from "@/components/ventas/sale-form";
import { createSale } from "../actions";

export default async function NuevaVentaPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sale_price, stock")
    .gt("stock", 0)
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/ventas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a ventas
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nueva venta</h1>
      <SaleForm products={products ?? []} action={createSale} />
    </div>
  );
}
