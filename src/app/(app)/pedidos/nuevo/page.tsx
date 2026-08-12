import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/pedidos/order-form";
import type { OrderItemDefault } from "@/components/pedidos/order-items-editor";
import { createOrder } from "../actions";

export default async function NuevoPedidoPage({
  searchParams,
}: {
  // Llegan cuando se viene desde "Crear pedido" en una venta que se quedó
  // sin stock de este producto en todo el negocio (ver CreateOrderLink en
  // SaleLineItems) — precargan el renglón para no tener que rebuscar el
  // producto de nuevo.
  searchParams: Promise<{ product_id?: string; variant_id?: string; quantity?: string }>;
}) {
  const { product_id, variant_id, quantity } = await searchParams;
  const supabase = await createClient();
  const [{ data: products }, { data: variants }, { data: categories }, { data: lines }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, cost_price, category_id, line_id")
      .order("name", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, product_id, color_name, cost_override, sku")
      .order("color_name", { ascending: true }),
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
    supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
  ]);

  const variantsByProduct = new Map<string, typeof variants>();
  for (const v of variants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const orderableProducts = (products ?? [])
    .map((p) => ({ ...p, variants: variantsByProduct.get(p.id) ?? [] }))
    .filter((p) => p.variants.length > 0);

  let defaultItems: OrderItemDefault[] | undefined;
  if (product_id && variant_id) {
    const product = orderableProducts.find((p) => p.id === product_id);
    const variant = product?.variants.find((v) => v.id === variant_id);
    if (product && variant) {
      defaultItems = [
        {
          product_id,
          variant_id,
          quantity: Math.max(1, Number(quantity) || 1),
          unit_cost: variant.cost_override ?? product.cost_price,
        },
      ];
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/pedidos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nuevo pedido</h1>
      <OrderForm
        products={orderableProducts}
        categories={categories ?? []}
        lines={lines ?? []}
        action={createOrder}
        defaultItems={defaultItems}
      />
    </div>
  );
}
