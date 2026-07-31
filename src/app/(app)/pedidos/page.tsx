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
                  <Th className="pr-5 text-right">Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orders.map((order) => (
                  <Tr key={order.id}>
                    <Td className="pl-5">
                      <Link href={`/pedidos/${order.id}`} className="hover:text-primary">
                        {formatDate(order.order_date)}
                      </Link>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
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
