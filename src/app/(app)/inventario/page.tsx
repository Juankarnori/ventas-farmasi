import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { StockTable, type StockGroup } from "@/components/inventario/stock-table";
import { MovementHistory } from "@/components/inventario/movement-history";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Vista = "mio" | "otra" | "todo";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista: vistaParam } = await searchParams;
  const vista: Vista = vistaParam === "mio" || vistaParam === "otra" ? vistaParam : "todo";

  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: products }, { data: categories }, { data: variants }, { data: profiles }, { data: variantStock }, { data: movements }] =
    await Promise.all([
      supabase.from("products").select("*").order("name", { ascending: true }),
      supabase.from("categories").select("id, name"),
      supabase.from("product_variants").select("*").order("color_name", { ascending: true }),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("variant_stock").select("*"),
      supabase
        .from("stock_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const otherProfile = (profiles ?? []).find((p) => p.id !== profile.id) ?? null;

  const stockByVariant = new Map<string, typeof variantStock>();
  for (const s of variantStock ?? []) {
    const list = stockByVariant.get(s.variant_id) ?? [];
    list!.push(s);
    stockByVariant.set(s.variant_id, list);
  }

  const variantsByProduct = new Map<string, typeof variants>();
  for (const v of variants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  function stockFor(variantId: string, threshold: number) {
    const rows = stockByVariant.get(variantId) ?? [];
    const mine = rows.find((r) => r.profile_id === profile.id);
    const other = otherProfile ? rows.find((r) => r.profile_id === otherProfile.id) : undefined;

    if (vista === "mio") return { stock: mine?.stock ?? 0, threshold: mine?.min_stock ?? threshold };
    if (vista === "otra")
      return { stock: other?.stock ?? 0, threshold: other?.min_stock ?? threshold };
    return { stock: (mine?.stock ?? 0) + (other?.stock ?? 0), threshold };
  }

  const groups: StockGroup[] = (products ?? []).map((p) => ({
    productId: p.id,
    productName: p.name,
    category: p.category_id ? (categoryById.get(p.category_id) ?? null) : null,
    variants: (variantsByProduct.get(p.id) ?? []).map((v) => ({
      id: v.id,
      colorName: v.color_name,
      ...stockFor(v.id, v.min_stock ?? p.low_stock_threshold),
    })),
  }));

  const tabs: { value: Vista; label: string }[] = [
    { value: "mio", label: "Mi stock" },
    { value: "otra", label: `Stock de ${otherProfile?.display_name ?? "la otra"}` },
    { value: "todo", label: "Todo el negocio" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Inventario</h1>
        <p className="mt-1 text-sm text-ink/60">Stock actual de todas las variantes de color.</p>
      </div>

      <div className="flex w-fit gap-1 rounded-full border border-gold/20 bg-panel/30 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/inventario?vista=${tab.value}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              vista === tab.value ? "bg-primary text-background" : "text-ink/60 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        <StockTable groups={groups} canAdjust={vista !== "otra"} />
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
            profile: profileById.get(m.profile_id) ?? null,
          }))}
        />
      </Card>
    </div>
  );
}
