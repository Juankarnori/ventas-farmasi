import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/catalogo/print-button";
import { PrintableCatalog, type PrintableCatalogItem } from "@/components/catalogo/printable-catalog";
import { formatDate } from "@/lib/utils/date";

// Vista imprimible del inventario PROPIO de quien la genera — mismo
// diseño que /imprimir/catalogo (ver PrintableCatalog), pero acá:
//   * solo variantes con stock de ESTA usuaria (variant_stock filtrado
//     por profile_id de la sesión, no el total del negocio),
//   * SÍ muestra la cantidad disponible (a diferencia del catálogo
//     compartido, esto es para uso propio, no para mandarle a una
//     clienta el stock exacto que a una le queda).
// Sin selector de usuaria: cada quien genera el suyo según la sesión con
// la que esté conectada.
export default async function ImprimirInventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; linea?: string }>;
}) {
  const profile = await getSessionProfile();
  const { categoria, linea } = await searchParams;
  const supabase = await createClient();

  const [{ data: categoryRow }, { data: lineRow }] = await Promise.all([
    categoria ? supabase.from("categories").select("name").eq("id", categoria).maybeSingle() : Promise.resolve({ data: null }),
    linea ? supabase.from("product_lines").select("name").eq("id", linea).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  let query = supabase.from("products").select("id, name, image_url, sale_price").order("name", { ascending: true });
  if (categoria) query = query.eq("category_id", categoria);
  if (linea) query = query.eq("line_id", linea);
  const { data: products } = await query;

  const productIds = (products ?? []).map((p) => p.id);

  interface PrintVariant {
    id: string;
    product_id: string;
    color_name: string;
    image_url: string | null;
    price_override: number | null;
  }

  const [{ data: variants }, { data: myStock }]: [{ data: PrintVariant[] | null }, { data: { variant_id: string; stock: number }[] | null }] =
    await Promise.all([
      productIds.length > 0
        ? supabase
            .from("product_variants")
            .select("id, product_id, color_name, image_url, price_override")
            .in("product_id", productIds)
            .order("color_name", { ascending: true })
        : Promise.resolve({ data: [] }),
      // Solo el stock de quien está generando el PDF — nunca el de la
      // otra usuaria ni el total del negocio.
      supabase.from("variant_stock").select("variant_id, stock").eq("profile_id", profile.id).gt("stock", 0),
    ]);

  const myStockByVariant = new Map((myStock ?? []).map((s) => [s.variant_id, s.stock]));

  const variantsByProduct = new Map<string, PrintVariant[]>();
  for (const v of variants ?? []) {
    if (!myStockByVariant.has(v.id)) continue;
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const items: PrintableCatalogItem[] = [];
  for (const [productId, productVariants] of variantsByProduct) {
    const product = productById.get(productId);
    if (!product) continue;
    for (const v of productVariants) {
      items.push({
        id: v.id,
        productName: product.name,
        colorName: productVariants.length > 1 ? v.color_name : null,
        imageUrl: v.image_url ?? product.image_url,
        price: v.price_override ?? product.sale_price,
        quantity: myStockByVariant.get(v.id) ?? 0,
      });
    }
  }

  const filterLabel = [categoryRow?.name, lineRow?.name].filter(Boolean).join(" · ") || null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-ink/60">
          Vista para compartir — {items.length} producto{items.length === 1 ? "" : "s"} en tu stock.
        </p>
        <PrintButton />
      </div>

      <PrintableCatalog
        title="Farmasi Bella"
        subtitle={`Mi inventario disponible — ${profile.display_name}${filterLabel ? ` · ${filterLabel}` : ""} · ${formatDate(new Date())}`}
        items={items}
        emptyMessage={`No tenés stock propio disponible${filterLabel ? " con este filtro" : ""}.`}
      />
    </div>
  );
}
