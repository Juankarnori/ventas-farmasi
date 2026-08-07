import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VentasFilters } from "@/components/ventas/ventas-filters";
import { SaleCard, type SaleCardData } from "@/components/ventas/sale-card";
import { VentasTabs } from "@/components/ventas/ventas-tabs";
import { variantLabel } from "@/lib/utils/variant-label";
import { formatCurrency } from "@/lib/utils/currency";
import { getSessionProfile } from "@/lib/auth/get-session-profile";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; usuaria?: string; producto?: string }>;
}) {
  const { desde, hasta, usuaria, producto } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  // Una no-admin nunca puede pedir las ventas de otra usuaria — ni por la
  // UI (el selector ya no aparece, ver VentasFilters) ni tocando el query
  // param a mano: acá se ignora cualquier `usuaria` que no sea la propia.
  // La RLS de `sales` ya lo bloquearía igual, pero así la pantalla nunca
  // llega a mostrar "0 resultados" por un filtro que en realidad no debería
  // haber podido elegir.
  const effectiveUsuaria = profile.is_admin ? usuaria : profile.id;

  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("products").select("id, name"),
  ]);

  let salesQuery = supabase
    .from("sales")
    .select("*")
    .in("payment_status", ["pagado", "completado"])
    .order("sale_date", { ascending: false });
  if (desde) salesQuery = salesQuery.gte("sale_date", desde);
  if (hasta) salesQuery = salesQuery.lte("sale_date", hasta);
  if (effectiveUsuaria) salesQuery = salesQuery.eq("seller_profile_id", effectiveUsuaria);

  const { data: sales } = await salesQuery;
  const saleIds = (sales ?? []).map((s) => s.id);

  let cards: SaleCardData[] = [];

  if (saleIds.length > 0) {
    // Siempre se traen TODOS los items de cada venta (nunca solo los que
    // matchean el filtro de producto): el filtro de producto decide qué
    // ventas califican para aparecer, pero la tarjeta de una venta que
    // calificó muestra la venta completa — todos sus productos, el total
    // y la ganancia reales —, no un recorte parcial que dejaría el total
    // sin cuadrar con lo que se ve adentro.
    const [{ data: items }, { data: variants }, { data: customers }] = await Promise.all([
      supabase.from("sale_items").select("*").in("sale_id", saleIds),
      supabase.from("product_variants").select("id, product_id, color_name"),
      supabase.from("customers").select("id, name"),
    ]);

    const qualifyingSaleIds = producto
      ? new Set((items ?? []).filter((i) => i.product_id === producto).map((i) => i.sale_id))
      : new Set(saleIds);

    const productById = new Map((products ?? []).map((p) => [p.id, p]));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
    const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

    function labelFor(item: { product_id: string; variant_id: string }) {
      const productName = productById.get(item.product_id)?.name ?? "—";
      const colorName = variantById.get(item.variant_id)?.color_name;
      return colorName ? variantLabel(productName, colorName) : productName;
    }

    const itemsBySale = new Map<string, typeof items>();
    for (const item of items ?? []) {
      const list = itemsBySale.get(item.sale_id) ?? [];
      list!.push(item);
      itemsBySale.set(item.sale_id, list);
    }

    cards = (sales ?? [])
      .filter((s) => qualifyingSaleIds.has(s.id))
      .map((s) => {
        const saleItems = itemsBySale.get(s.id) ?? [];

        // Agrupa por variante por si el mismo color quedó en más de un
        // renglón (no debería pasar desde el formulario, pero no cuesta
        // nada ser robusto acá igual que en la ficha de cliente).
        const productMap = new Map<string, { label: string; quantity: number }>();
        let saleProfit = 0;
        for (const item of saleItems) {
          const entry = productMap.get(item.variant_id) ?? { label: labelFor(item), quantity: 0 };
          entry.quantity += item.quantity;
          productMap.set(item.variant_id, entry);
          saleProfit += item.profit;
        }

        return {
          id: s.id,
          saleDate: s.sale_date,
          // customer_id es el dato de verdad cuando la venta está
          // vinculada a una clienta formal (ver customer-combobox.tsx);
          // customer_name es el texto libre de respaldo para ventas
          // anónimas o anteriores al registro de clientas.
          customerName: (s.customer_id ? customerById.get(s.customer_id)?.name : null) ?? s.customer_name,
          sellerName: profileById.get(s.seller_profile_id)?.display_name ?? "—",
          products: Array.from(productMap.values()),
          // El total ya viene calculado y guardado en la venta misma
          // (sales.total_price) — se reusa tal cual en vez de volver a
          // sumarlo acá, para no tener dos cálculos del mismo número que
          // puedan desincronizarse.
          total: s.total_price,
          profit: saleProfit,
          paymentStatus: s.payment_status,
          paymentMethod: s.payment_method,
          bankNote: s.bank_note,
        } satisfies SaleCardData;
      })
      .sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));
  }

  const totalSales = cards.reduce((sum, c) => sum + c.total, 0);
  const totalProfit = cards.reduce((sum, c) => sum + c.profit, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Ventas</h1>
          <p className="mt-1 text-sm text-ink/60">Historial de ventas y ganancias.</p>
        </div>
        <Link href="/ventas/nueva">
          <Button>
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <VentasTabs active="ventas" />
      </div>

      <div className="mt-6">
        <VentasFilters profiles={profiles ?? []} products={products ?? []} isAdmin={profile.is_admin} />
      </div>

      <div className="mt-6">
        {sales && sales.length > 0 ? (
          cards.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((c) => (
                  <SaleCard key={c.id} sale={c} />
                ))}
              </div>
              <p className="mt-4 text-right text-sm text-ink/60">
                Total de ventas:{" "}
                <span className="font-mono text-base tabular-nums text-ink">
                  {formatCurrency(totalSales)}
                </span>{" "}
                · Ganancia total:{" "}
                <span className="font-mono text-base tabular-nums text-ink">
                  {formatCurrency(totalProfit)}
                </span>
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-ink/50">No hay ventas para este filtro.</p>
          )
        ) : (
          <EmptyState
            icon={Receipt}
            title="Todavía no hay ventas"
            description="Registrá la primera venta para verla acá."
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
