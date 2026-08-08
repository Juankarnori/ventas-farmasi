import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/components/ui/action-button";
import { OrderStatusBadge } from "@/components/pedidos/order-status-badge";
import { OrderEditPanel, type OrderDisplayRow } from "@/components/pedidos/order-edit-panel";
import type { OrderItemDefault } from "@/components/pedidos/order-items-editor";
import { formatDate } from "@/lib/utils/date";
import { variantLabel } from "@/lib/utils/variant-label";
import { markOrderReceived, updateOrder } from "../actions";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: order },
    { data: items },
    { data: allProducts },
    { data: variants },
    { data: categories },
    { data: lines },
  ] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase
      .from("products")
      .select("id, name, cost_price, category_id, line_id")
      .order("name", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, product_id, color_name, cost_override")
      .order("color_name", { ascending: true }),
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
    supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
  ]);

  if (!order) {
    notFound();
  }

  const productById = new Map((allProducts ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const markReceivedWithId = markOrderReceived.bind(null, id);
  const updateOrderWithId = updateOrder.bind(null, id);

  const variantsByProduct = new Map<string, typeof variants>();
  for (const v of variants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const orderableProducts = (allProducts ?? [])
    .map((p) => ({ ...p, variants: variantsByProduct.get(p.id) ?? [] }))
    .filter((p) => p.variants.length > 0);

  const displayRows: OrderDisplayRow[] = (items ?? []).map((item) => {
    const productName = productById.get(item.product_id)?.name;
    const colorName = variantById.get(item.variant_id)?.color_name;
    return {
      id: item.id,
      variantId: item.variant_id,
      label: productName && colorName ? variantLabel(productName, colorName) : "—",
      quantity: item.quantity,
      unitCost: item.unit_cost,
    };
  });

  const defaultItems: OrderItemDefault[] = (items ?? []).map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    quantity: item.quantity,
    unit_cost: item.unit_cost,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/pedidos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Pedido del {formatDate(order.order_date)}</h1>
          <div className="mt-1">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
        {order.status === "pendiente" && (
          <ActionButton action={markReceivedWithId}>
            <CheckCircle2 className="h-4 w-4" /> Marcar como recibido
          </ActionButton>
        )}
      </div>

      <OrderEditPanel
        isPending={order.status === "pendiente"}
        displayRows={displayRows}
        totalCost={order.total_cost}
        defaultItems={defaultItems}
        products={orderableProducts}
        categories={categories ?? []}
        lines={lines ?? []}
        action={updateOrderWithId}
      />
    </div>
  );
}
