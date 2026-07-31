import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/pedidos/order-form";
import { createOrder } from "../actions";

export default async function NuevoPedidoPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, cost_price")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/pedidos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nuevo pedido</h1>
      <OrderForm products={products ?? []} action={createOrder} />
    </div>
  );
}
