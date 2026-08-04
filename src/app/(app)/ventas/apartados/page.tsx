import Link from "next/link";
import { Plus, HandHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VentasTabs } from "@/components/ventas/ventas-tabs";
import { ApartadoCard, type ApartadoCardData } from "@/components/ventas/apartado-card";

export default async function ApartadosPage() {
  const supabase = await createClient();

  const [{ data: sales }, { data: profiles }] = await Promise.all([
    supabase
      .from("sales")
      .select("*")
      .in("payment_status", ["con_abonos", "completado", "cancelado"])
      .order("sale_date", { ascending: false }),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const saleIds = (sales ?? []).map((s) => s.id);

  const [{ data: balances }, { data: items }] = await Promise.all([
    saleIds.length > 0
      ? supabase.from("sale_balances").select("*").in("sale_id", saleIds)
      : Promise.resolve({ data: [] }),
    saleIds.length > 0
      ? supabase.from("sale_items").select("sale_id, delivered").in("sale_id", saleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const balanceBySale = new Map((balances ?? []).map((b) => [b.sale_id, b]));

  const deliveredBySale = new Map<string, boolean>();
  for (const item of items ?? []) {
    const current = deliveredBySale.get(item.sale_id) ?? true;
    deliveredBySale.set(item.sale_id, current && item.delivered);
  }

  const apartados: ApartadoCardData[] = (sales ?? []).map((s) => {
    const balance = balanceBySale.get(s.id);
    return {
      id: s.id,
      customerName: s.customer_name ?? "Sin nombre",
      sellerName: profileById.get(s.seller_profile_id)?.display_name ?? "—",
      saleDate: s.sale_date,
      total: s.total_price,
      paid: balance?.amount_paid ?? 0,
      balance: balance?.balance ?? s.total_price,
      status: s.payment_status,
      allDelivered: deliveredBySale.get(s.id) ?? true,
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Apartados</h1>
          <p className="mt-1 text-sm text-ink/60">Clientas que pagan de a poco.</p>
        </div>
        <Link href="/ventas/nueva">
          <Button>
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <VentasTabs active="apartados" />
      </div>

      <div className="mt-6">
        {apartados.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apartados.map((a) => (
              <ApartadoCard key={a.id} apartado={a} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={HandHeart}
            title="Todavía no hay apartados"
            description="Cuando una clienta pague de a poco, creá la venta como apartado desde acá."
            action={
              <Link href="/ventas/nueva">
                <Button size="sm">Nueva venta</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
