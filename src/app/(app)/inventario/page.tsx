import { createClient } from "@/lib/supabase/server";
import { StockTable, type StockGroup } from "@/components/inventario/stock-table";
import { MovementHistory } from "@/components/inventario/movement-history";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InventarioPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: categories }, { data: variants }, { data: movements }] =
    await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("categories").select("id, name"),
      supabase.from("product_variants").select("*").order("color_name", { ascending: true }),
      supabase
        .from("stock_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  const variantsByProduct = new Map<string, typeof variants>();
  for (const v of variants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const groups: StockGroup[] = (products ?? []).map((p) => ({
    productId: p.id,
    productName: p.name,
    category: p.category_id ? (categoryById.get(p.category_id) ?? null) : null,
    variants: (variantsByProduct.get(p.id) ?? []).map((v) => ({
      id: v.id,
      colorName: v.color_name,
      stock: v.stock,
      threshold: v.min_stock ?? p.low_stock_threshold,
    })),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Inventario</h1>
        <p className="mt-1 text-sm text-ink/60">Stock actual de todas las variantes de color.</p>
      </div>

      <Card className="p-0">
        <StockTable groups={groups} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
        </CardHeader>
        <MovementHistory
          movements={(movements ?? []).map((m) => ({
            ...m,
            product: productById.get(m.product_id) ?? null,
            variant: variantById.get(m.variant_id) ?? null,
          }))}
        />
      </Card>
    </div>
  );
}
