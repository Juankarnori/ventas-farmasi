import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/catalogo/print-button";
import { PrintableCatalog, type PrintableCatalogItem } from "@/components/catalogo/printable-catalog";
import { formatDate } from "@/lib/utils/date";

// Vista imprimible del catálogo disponible, pensada para compartir (ej.
// por WhatsApp) como si fuera un mini-catálogo — NO es un PDF generado en
// el servidor (nada de navegador headless que mantener en el plan
// gratuito de Vercel): esta página tiene su propio diseño para
// @media print y el botón de arriba solo dispara window.print(), la
// persona elige "Guardar como PDF" desde el diálogo nativo del
// navegador.
//
// Vive FUERA de (app) a propósito — sin sidebar/topbar/nav, para que
// tanto en pantalla como al imprimir se vea como una página propia, no
// como el resto de la app con los menúes recortados.
export default async function ImprimirCatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; linea?: string }>;
}) {
  // Mismo guard de sesión que usa (app)/layout.tsx — esta página no
  // hereda ese layout, así que lo repite acá.
  await getSessionProfile();
  const { q, categoria, linea } = await searchParams;
  const supabase = await createClient();

  const [{ data: categoryRow }, { data: lineRow }] = await Promise.all([
    categoria ? supabase.from("categories").select("name").eq("id", categoria).maybeSingle() : Promise.resolve({ data: null }),
    linea ? supabase.from("product_lines").select("name").eq("id", linea).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  let query = supabase.from("products").select("id, name, image_url, sale_price").order("name", { ascending: true });
  if (categoria) query = query.eq("category_id", categoria);
  if (linea) query = query.eq("line_id", linea);

  // Mismo criterio de búsqueda por nombre o código que /catalogo (ver
  // filterProducts/página de Catálogo): se combina en JS en vez de un
  // filtro .or() con el texto de la usuaria interpolado a mano.
  const [{ data: productsRaw }, { data: skuMatches }] = await Promise.all([
    query,
    q ? supabase.from("product_variants").select("product_id").ilike("sku", `%${q}%`) : Promise.resolve({ data: [] }),
  ]);

  const skuMatchedProductIds = new Set((skuMatches ?? []).map((v) => v.product_id));
  const qLower = q?.toLowerCase() ?? "";
  const productsFiltered = q
    ? (productsRaw ?? []).filter((p) => p.name.toLowerCase().includes(qLower) || skuMatchedProductIds.has(p.id))
    : (productsRaw ?? []);

  interface PrintVariant {
    id: string;
    product_id: string;
    color_name: string;
    image_url: string | null;
    price_override: number | null;
    stock: number;
  }

  const productIds = productsFiltered.map((p) => p.id);
  const { data: variants }: { data: PrintVariant[] | null } =
    productIds.length > 0
      ? await supabase
          .from("product_variants")
          .select("id, product_id, color_name, image_url, price_override, stock")
          .in("product_id", productIds)
          // Solo lo que de verdad hay para vender — mismo campo que ya
          // mantiene el trigger de variant_stock (ver
          // available-stock.ts), suma de todas las usuarias.
          .gt("stock", 0)
          .order("color_name", { ascending: true })
      : { data: [] };

  const variantsByProduct = new Map<string, PrintVariant[]>();
  for (const v of variants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const productById = new Map(productsFiltered.map((p) => [p.id, p]));

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
      });
    }
  }

  const filterLabel = [categoryRow?.name, lineRow?.name].filter(Boolean).join(" · ") || (q ? `"${q}"` : null);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-ink/60">
          Vista para compartir — {items.length} producto{items.length === 1 ? "" : "s"} disponible
          {items.length === 1 ? "" : "s"}.
        </p>
        <PrintButton />
      </div>

      <PrintableCatalog
        title="Farmasi Bella"
        subtitle={`Catálogo disponible${filterLabel ? ` — ${filterLabel}` : ""} · ${formatDate(new Date())}`}
        items={items}
        emptyMessage={`No hay productos con stock disponible${filterLabel ? " con este filtro" : ""}.`}
      />
    </div>
  );
}
