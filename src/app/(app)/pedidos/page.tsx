import Link from "next/link";
import { Plus, PackageCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/components/pedidos/order-status-badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .order("order_date", { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: items } =
    orderIds.length > 0
      ? await supabase.from("order_items").select("order_id, quantity").in("order_id", orderIds)
      : { data: [] };

  const unitsByOrder = new Map<string, number>();
  for (const item of items ?? []) {
    unitsByOrder.set(item.order_id, (unitsByOrder.get(item.order_id) ?? 0) + item.quantity);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Pedidos</h1>
          <p className="mt-1 text-sm text-ink/60">Reposiciones compradas a Farmasi.</p>
        </div>
        <Link href="/pedidos/nuevo">
          <Button>
            <Plus className="h-4 w-4" /> Nuevo pedido
          </Button>
        </Link>
      </div>

      <div className="mt-6">
        {orders && orders.length > 0 ? (
          <Card className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th className="pl-5">Fecha</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Productos</Th>
                  <Th className="pr-5 text-right">Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orders.map((order) => (
                  // Los cancelados se muestran atenuados en vez de
                  // ocultarse: a diferencia de Apartados (donde ocultar
                  // los resueltos despeja una lista de pendientes por
                  // hacer), Pedidos es un registro histórico de compras a
                  // Farmasi — sirve seguir viéndolos acá para saber qué se
                  // canceló y cuándo, sin tener que ir a buscarlos aparte.
                  <Tr key={order.id} className={order.status === "cancelado" ? "opacity-50" : undefined}>
                    <Td className="pl-5">
                      <Link href={`/pedidos/${order.id}`} className="hover:text-primary">
                        {formatDate(order.order_date)}
                      </Link>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td numeric>{unitsByOrder.get(order.id) ?? 0}</Td>
                    <Td numeric className="pr-5">
                      {formatCurrency(order.total_cost)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        ) : (
          <EmptyState
            icon={PackageCheck}
            title="Todavía no hay pedidos"
            description="Registrá tu primera reposición de Farmasi."
            action={
              <Link href="/pedidos/nuevo">
                <Button size="sm">Nuevo pedido</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
