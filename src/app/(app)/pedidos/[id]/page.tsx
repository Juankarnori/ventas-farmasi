import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/pedidos/order-status-badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { variantLabel } from "@/lib/utils/variant-label";
import { markOrderReceived } from "../actions";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: products }, { data: variants }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("products").select("id, name"),
    supabase.from("product_variants").select("id, color_name"),
  ]);

  if (!order) {
    notFound();
  }

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const markReceivedWithId = markOrderReceived.bind(null, id);

  const totalUnits = (items ?? []).reduce((sum, item) => sum + item.quantity, 0);

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
          <form action={markReceivedWithId}>
            <Button type="submit">
              <CheckCircle2 className="h-4 w-4" /> Marcar como recibido
            </Button>
          </form>
        )}
      </div>

      <Card className="mt-6 p-0">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-5">Producto</Th>
              <Th className="text-right">Cantidad</Th>
              <Th className="pr-5 text-right">Costo unitario</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items?.map((item) => (
              <Tr key={item.id}>
                <Td className="pl-5">
                  {(() => {
                    const productName = productById.get(item.product_id)?.name;
                    const colorName = variantById.get(item.variant_id)?.color_name;
                    return productName && colorName ? variantLabel(productName, colorName) : "—";
                  })()}
                </Td>
                <Td numeric>{item.quantity}</Td>
                <Td numeric className="pr-5">
                  {formatCurrency(item.unit_cost)}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      <p className="mt-4 text-right text-sm text-ink/60">
        {totalUnits} producto{totalUnits === 1 ? "" : "s"} · Total del pedido:{" "}
        <span className="font-mono text-base tabular-nums text-ink">
          {formatCurrency(order.total_cost)}
        </span>
      </p>
    </div>
  );
}
