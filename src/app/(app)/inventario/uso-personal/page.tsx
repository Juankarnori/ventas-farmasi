import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { InventarioTabs } from "@/components/inventario/inventario-tabs";
import { PersonalUseForm, type PersonalUseProduct } from "@/components/inventario/personal-use-form";
import { PersonalUseFilters } from "@/components/inventario/personal-use-filters";
import { PersonalUseHistory, type PersonalUseRow } from "@/components/inventario/personal-use-history";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { variantLabel } from "@/lib/utils/variant-label";
import { registerPersonalUse } from "../actions";

export default async function UsoPersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ usuaria?: string; desde?: string; hasta?: string }>;
}) {
  const { usuaria, desde, hasta } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: products }, { data: variants }, { data: myStock }, { data: profiles }, { data: categories }, { data: lines }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, category_id, line_id")
        .order("name", { ascending: true }),
      supabase
        .from("product_variants")
        .select("id, product_id, color_name, sku")
        .order("color_name", { ascending: true }),
      // Solo se puede registrar uso personal de lo que una tiene en su
      // propio stock — mismo criterio que Ventas.
      supabase.from("variant_stock").select("variant_id, stock").eq("profile_id", profile.id).gt("stock", 0),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
      supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
    ]);

  const myStockByVariant = new Map((myStock ?? []).map((s) => [s.variant_id, s.stock]));
  const variantsByProduct = new Map<string, typeof variants>();
  for (const v of variants ?? []) {
    if (!myStockByVariant.has(v.id)) continue;
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const usableProducts: PersonalUseProduct[] = (products ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      category_id: p.category_id,
      line_id: p.line_id,
      variants: (variantsByProduct.get(p.id) ?? []).map((v) => ({
        id: v.id,
        color_name: v.color_name,
        sku: v.sku,
        stock: myStockByVariant.get(v.id) ?? 0,
      })),
    }))
    .filter((p) => p.variants.length > 0);

  // Historial: compartido entre todas (mismo criterio que Préstamos e
  // Inventario), filtrable por usuaria y fecha — el filtro es de vista,
  // no de acceso.
  let historyQuery = supabase.from("personal_use").select("*").order("used_at", { ascending: false });
  if (usuaria) historyQuery = historyQuery.eq("profile_id", usuaria);
  if (desde) historyQuery = historyQuery.gte("used_at", desde);
  if (hasta) historyQuery = historyQuery.lte("used_at", hasta);
  const { data: entries } = await historyQuery;

  const variantIds = [...new Set((entries ?? []).map((e) => e.variant_id))];
  const [{ data: allProducts }, { data: allVariants }] = await Promise.all([
    supabase.from("products").select("id, name"),
    variantIds.length > 0
      ? supabase.from("product_variants").select("id, color_name").in("id", variantIds)
      : Promise.resolve({ data: [] }),
  ]);

  const productById = new Map((allProducts ?? []).map((p) => [p.id, p]));
  const variantById = new Map((allVariants ?? []).map((v) => [v.id, v]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows: PersonalUseRow[] = (entries ?? []).map((e) => {
    const productName = productById.get(e.product_id)?.name ?? "—";
    const colorName = variantById.get(e.variant_id)?.color_name;
    return {
      id: e.id,
      usedAt: e.used_at,
      label: colorName ? variantLabel(productName, colorName) : productName,
      quantity: e.quantity,
      value: e.quantity * (e.unit_cost ?? 0),
      note: e.note,
      profileName: profileById.get(e.profile_id)?.display_name ?? "—",
      profileId: e.profile_id,
      reimbursedAmount: e.reimbursed_amount,
      reimbursedNote: e.reimbursed_note,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-ink">Inventario</h1>
        <p className="mt-1 text-sm text-ink/60">
          Uso personal: descuenta stock por consumo propio — nunca cuenta como venta ni como
          ganancia en Finanzas.
        </p>
      </div>

      <InventarioTabs active="uso-personal" />

      <Card>
        <CardHeader>
          <CardTitle>Registrar uso personal</CardTitle>
        </CardHeader>
        <PersonalUseForm
          products={usableProducts}
          categories={categories ?? []}
          lines={lines ?? []}
          action={registerPersonalUse}
        />
      </Card>

      <Card className="p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <div className="px-5 pb-4">
          <PersonalUseFilters profiles={profiles ?? []} />
        </div>
        <PersonalUseHistory rows={rows} currentProfileId={profile.id} isAdmin={profile.is_admin} />
      </Card>
    </div>
  );
}
