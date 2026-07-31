import { createClient } from "@/lib/supabase/server";
import { StockTable } from "@/components/inventario/stock-table";
import { MovementHistory } from "@/components/inventario/movement-history";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InventarioPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: categories }, { data: movements }] = await Promise.all([
    supabase.from("products").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("id, name"),
    supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Inventario</h1>
        <p className="mt-1 text-sm text-ink/60">Stock actual de todos los productos.</p>
      </div>

      <Card>
        <StockTable
          products={(products ?? []).map((p) => ({
            ...p,
            category: p.category_id ? (categoryById.get(p.category_id) ?? null) : null,
          }))}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
        </CardHeader>
        <MovementHistory
          movements={(movements ?? []).map((m) => ({
            ...m,
            product: productById.get(m.product_id) ?? null,
          }))}
        />
      </Card>
    </div>
  );
}
