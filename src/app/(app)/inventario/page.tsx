import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { StockTable, type StockGroup } from "@/components/inventario/stock-table";
import { MovementHistory } from "@/components/inventario/movement-history";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Vista = "mio" | "todo" | string; // string suelto = el profile_id de una persona específica

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista: vistaParam } = await searchParams;

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

  const otherProfiles = (profiles ?? []).filter((p) => p.id !== profile.id);
  const otherProfileIds = new Set(otherProfiles.map((p) => p.id));

  // "vista" acepta "mio", "todo", o el id de cualquier otra persona del
  // equipo — si viene algo que ya no es válido (ej. alguien que ya no
  // está en el equipo), volvemos a "todo".
  const vista: Vista =
    vistaParam === "mio" || vistaParam === "todo" || (vistaParam && otherProfileIds.has(vistaParam))
      ? vistaParam
      : "todo";

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

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

    if (vista === "mio") {
      const mine = rows.find((r) => r.profile_id === profile.id);
      return { stock: mine?.stock ?? 0, threshold: mine?.min_stock ?? threshold };
    }

    if (vista === "todo") {
      const total = rows.reduce((sum, r) => sum + r.stock, 0);
      return { stock: total, threshold };
    }

    // vista es el profile_id de una persona específica del equipo
    const row = rows.find((r) => r.profile_id === vista);
    return { stock: row?.stock ?? 0, threshold: row?.min_stock ?? threshold };
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

  const tabs: { value: string; label: string }[] = [
    { value: "mio", label: "Mi stock" },
    ...otherProfiles.map((p) => ({ value: p.id, label: `Stock de ${p.display_name}` })),
    { value: "todo", label: "Todo el negocio" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Inventario</h1>
        <p className="mt-1 text-sm text-ink/60">Stock actual de todas las variantes de color.</p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-full border border-gold/20 bg-panel/30 p-1">
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
        <StockTable groups={groups} canAdjust={vista === "mio" || vista === "todo"} />
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
