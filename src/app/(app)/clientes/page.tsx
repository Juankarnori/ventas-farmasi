import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientesTabs } from "@/components/clientes/clientes-tabs";
import { ClienteFilters } from "@/components/clientes/cliente-filters";
import { CustomerCard, type CustomerCardData } from "@/components/clientes/customer-card";
import { FollowUpToday } from "@/components/clientes/follow-up-today";
import { getPendingFollowUps } from "@/lib/queries/pending-follow-ups";
import { formatCurrency } from "@/lib/utils/currency";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*")
    // Las archivadas (borrado "seguro" cuando tenían ventas/seguimientos
    // asociados — ver delete_customer) no se pierden, solo dejan de
    // aparecer acá. Se puede seguir entrando a su ficha por link directo.
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  const [{ data: customers }, { data: totals }, { data: pendingBalances }, followUpTasks] = await Promise.all([
    query,
    // Clientes es un registro compartido de seguimiento (como Catálogo o
    // Préstamos): el ranking por total gastado tiene que sumar las ventas
    // de todas las usuarias, no solo las propias — por eso esto no
    // consulta `sales`/`sale_items` directo (RLS los filtraría a "lo mío")
    // sino una función que agrega el negocio entero a propósito. Ver
    // 0022_privacy_orders_sales.sql.
    supabase.rpc("list_customer_totals"),
    // Badge de "Saldo pendiente": mismo criterio compartido de arriba.
    supabase.rpc("list_customer_pending_balances"),
    // "Hoy toca contactar": misma función que usa el resumen de Inicio,
    // para que las dos vistas siempre coincidan.
    getPendingFollowUps(supabase),
  ]);

  const totalsByCustomer = new Map((totals ?? []).map((t) => [t.customer_id, t.total_spent]));
  const purchaseCountByCustomer = new Map((totals ?? []).map((t) => [t.customer_id, t.purchase_count]));
  const pendingBalanceByCustomer = new Map(
    (pendingBalances ?? []).map((b) => [b.customer_id, b.pending_balance]),
  );

  const cards: CustomerCardData[] = (customers ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      totalSpent: totalsByCustomer.get(c.id) ?? 0,
      purchaseCount: purchaseCountByCustomer.get(c.id) ?? 0,
      pendingBalance: pendingBalanceByCustomer.get(c.id),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const totalSpentAll = cards.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Clientes</h1>
          <p className="mt-1 text-sm text-ink/60">
            {cards.length} registrada{cards.length === 1 ? "" : "s"}
            {totalSpentAll > 0 && ` · ${formatCurrency(totalSpentAll)} en compras`}
          </p>
        </div>
        <Link href="/clientes/nuevo">
          <Button>
            <Plus className="h-4 w-4" /> Nueva clienta
          </Button>
        </Link>
      </div>

      <ClientesTabs active="clientes" />

      <FollowUpToday tasks={followUpTasks} />

      <ClienteFilters />

      <div>
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
                : "Agregala desde acá o rápido desde el formulario de una venta."
            }
          />
        )}
      </div>
    </div>
  );
}
