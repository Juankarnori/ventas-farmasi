import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VentasFilters } from "@/components/ventas/ventas-filters";
import { SaleHistoryTable, type SaleHistoryRow } from "@/components/ventas/sale-history-table";
import { VentasTabs } from "@/components/ventas/ventas-tabs";
import { variantLabel } from "@/lib/utils/variant-label";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; usuaria?: string; producto?: string }>;
}) {
  const { desde, hasta, usuaria, producto } = await searchParams;
  const supabase = await createClient();

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
  if (usuaria) salesQuery = salesQuery.eq("seller_profile_id", usuaria);

  const { data: sales } = await salesQuery;
  const saleIds = (sales ?? []).map((s) => s.id);

  let rows: SaleHistoryRow[] = [];

  if (saleIds.length > 0) {
    let itemsQuery = supabase.from("sale_items").select("*").in("sale_id", saleIds);
    if (producto) itemsQuery = itemsQuery.eq("product_id", producto);
    const { data: items } = await itemsQuery;

    const variantIds = (items ?? []).map((i) => i.variant_id);
    const { data: variants } =
      variantIds.length > 0
        ? await supabase.from("product_variants").select("id, color_name").in("id", variantIds)
        : { data: [] };

    const saleById = new Map((sales ?? []).map((s) => [s.id, s]));
    const productById = new Map((products ?? []).map((p) => [p.id, p]));
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

    rows = (items ?? [])
      .map((item) => {
        const sale = saleById.get(item.sale_id);
        if (!sale) return null;
        const productName = productById.get(item.product_id)?.name ?? "—";
        const colorName = variantById.get(item.variant_id)?.color_name;
        return {
          id: item.id,
          saleDate: sale.sale_date,
          customerName: sale.customer_name,
          sellerName: profileById.get(sale.seller_profile_id)?.display_name ?? "—",
          productName: colorName ? variantLabel(productName, colorName) : productName,
          quantity: item.quantity,
          salePrice: item.sale_price,
          profit: item.profit,
        } satisfies SaleHistoryRow;
      })
      .filter((r): r is SaleHistoryRow => r !== null)
      .sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));
  }

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
        <VentasFilters profiles={profiles ?? []} products={products ?? []} />
      </div>

      <div className="mt-6">
        {sales && sales.length > 0 ? (
          <Card className="p-0">
            <SaleHistoryTable rows={rows} />
          </Card>
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
