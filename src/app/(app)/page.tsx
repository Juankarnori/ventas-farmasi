import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { createClient } from "@/lib/supabase/server";
import { getAvailableStock } from "@/lib/queries/available-stock";
import { getTopSellingProducts } from "@/lib/queries/top-selling-products";
import { getPendingFollowUps } from "@/lib/queries/pending-follow-ups";
import { StockCarousel } from "@/components/inicio/stock-carousel";
import { TopSellersCard } from "@/components/inicio/top-sellers-card";
import { TopCustomersCard, type TopCustomerRow } from "@/components/inicio/top-customers-card";
import { PendingFollowUpsCard } from "@/components/inicio/pending-follow-ups-card";
import { cn } from "@/lib/utils/cn";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ stock?: string }>;
}) {
  const { stock } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  // Mismo criterio de privacidad que ya usa Inventario: una no-admin
  // siempre ve solo su propio stock acá; la admin puede alternar (por
  // defecto ve el negocio completo, que es lo más útil para un vistazo
  // rápido de "qué tenemos para ofrecer").
  const stockScope: "mio" | "todo" = profile.is_admin ? (stock === "mio" ? "mio" : "todo") : "mio";

  const [availableStock, topProducts, { data: customerTotals }, pendingFollowUps] = await Promise.all([
    getAvailableStock(supabase, { profileId: profile.id, scope: stockScope }),
    // Mismo criterio de privacidad que Finanzas: no-admin ve solo lo
    // propio, admin ve el negocio completo.
    getTopSellingProducts(supabase, { sellerId: profile.is_admin ? null : profile.id, limit: 5 }),
    // Clientes es compartido a propósito (ver 0022_privacy_orders_sales.sql):
    // el ranking sale igual para todas, sin importar is_admin.
    supabase.rpc("list_customer_totals"),
    getPendingFollowUps(supabase),
  ]);

  const topCustomerTotals = [...(customerTotals ?? [])]
    .sort((a, b) => b.total_spent - a.total_spent)
    .slice(0, 5);
  const topCustomerIds = topCustomerTotals.map((t) => t.customer_id);
  const { data: topCustomerRows } =
    topCustomerIds.length > 0
      ? await supabase.from("customers").select("id, name").in("id", topCustomerIds)
      : { data: [] };
  const customerNameById = new Map((topCustomerRows ?? []).map((c) => [c.id, c.name]));

  const topCustomers: TopCustomerRow[] = topCustomerTotals.map((t) => ({
    id: t.customer_id,
    name: customerNameById.get(t.customer_id) ?? "—",
    totalSpent: t.total_spent,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Inicio</h1>
        <p className="mt-1 text-sm text-ink/60">Un vistazo rápido a cómo está el negocio hoy.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg text-ink">Disponible para vender</h2>
            <Link href="/inventario" className="text-xs font-medium text-primary hover:underline">
              Ver inventario completo
            </Link>
          </div>
          {profile.is_admin && (
            <div className="flex w-fit gap-1 rounded-full border border-gold/20 bg-panel/30 p-1">
              {(["todo", "mio"] as const).map((value) => (
                <Link
                  key={value}
                  href={`/?stock=${value}`}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    stockScope === value ? "bg-primary text-background" : "text-ink/60 hover:text-ink",
                  )}
                >
                  {value === "mio" ? "Mi stock" : "Todo el negocio"}
                </Link>
              ))}
            </div>
          )}
        </div>
        <StockCarousel items={availableStock} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TopSellersCard products={topProducts} />
        <TopCustomersCard customers={topCustomers} />
        <PendingFollowUpsCard tasks={pendingFollowUps} />
      </div>
    </div>
  );
}
