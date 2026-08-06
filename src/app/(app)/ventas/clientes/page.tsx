import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VentasTabs } from "@/components/ventas/ventas-tabs";
import { ClienteFilters } from "@/components/ventas/cliente-filters";
import { CustomerCard, type CustomerCardData } from "@/components/ventas/customer-card";
import { formatCurrency } from "@/lib/utils/currency";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("customers").select("*").order("name", { ascending: true });
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data: customers } = await query;

  const customerIds = (customers ?? []).map((c) => c.id);

  const { data: sales } =
    customerIds.length > 0
      ? await supabase
          .from("sales")
          .select("id, customer_id")
          .in("customer_id", customerIds)
          .in("payment_status", ["pagado", "completado"])
      : { data: [] };

  const saleIds = (sales ?? []).map((s) => s.id);
  const { data: items } =
    saleIds.length > 0
      ? await supabase.from("sale_items").select("sale_id, sale_price, quantity").in("sale_id", saleIds)
      : { data: [] };

  const customerBySale = new Map((sales ?? []).map((s) => [s.id, s.customer_id]));
  const totalsByCustomer = new Map<string, number>();
  for (const item of items ?? []) {
    const customerId = customerBySale.get(item.sale_id);
    if (!customerId) continue;
    totalsByCustomer.set(
      customerId,
      (totalsByCustomer.get(customerId) ?? 0) + item.sale_price * item.quantity,
    );
  }

  const purchaseCountByCustomer = new Map<string, number>();
  for (const s of sales ?? []) {
    if (!s.customer_id) continue;
    purchaseCountByCustomer.set(s.customer_id, (purchaseCountByCustomer.get(s.customer_id) ?? 0) + 1);
  }

  const cards: CustomerCardData[] = (customers ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalSpent: totalsByCustomer.get(c.id) ?? 0,
      purchaseCount: purchaseCountByCustomer.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const totalSpentAll = cards.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Clientes</h1>
          <p className="mt-1 text-sm text-ink/60">
            {cards.length} registrada{cards.length === 1 ? "" : "s"}
            {totalSpentAll > 0 && ` · ${formatCurrency(totalSpentAll)} en compras`}
          </p>
        </div>
        <Link href="/ventas/nueva">
          <Button>
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <VentasTabs active="clientes" />
      </div>

      <div className="mt-6">
        <ClienteFilters />
      </div>

      <div className="mt-6">
        {cards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <CustomerCard key={c.id} customer={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={q ? "No hay clientes con ese filtro" : "Todavía no hay clientes registrados"}
            description={
              q
                ? "Probá con otro nombre o teléfono."
                : "Se registran solas cuando cargás su nombre en una venta, o agregala rápido desde ahí."
            }
          />
        )}
      </div>
    </div>
  );
}
