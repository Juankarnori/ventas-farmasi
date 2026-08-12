import { ImageOff } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/catalogo/print-button";
import { formatCurrency } from "@/lib/utils/currency";
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

  const items = productsFiltered
    .map((p) => ({ product: p, variants: variantsByProduct.get(p.id) ?? [] }))
    .filter((entry) => entry.variants.length > 0);

  const totalCards = items.reduce((sum, entry) => sum + entry.variants.length, 0);

  const filterLabel = [categoryRow?.name, lineRow?.name].filter(Boolean).join(" · ") || (q ? `"${q}"` : null);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-ink/60">
          Vista para compartir — {totalCards} producto{totalCards === 1 ? "" : "s"} disponible
          {totalCards === 1 ? "" : "s"}.
        </p>
        <PrintButton />
      </div>

      <header className="mb-8 border-b-2 border-primary/30 pb-4 text-center print:mb-6">
        <h1 className="font-display text-3xl text-primary">Farmasi Bella</h1>
        <p className="mt-1 text-sm text-ink/60">
          Catálogo disponible{filterLabel ? ` — ${filterLabel}` : ""} · {formatDate(new Date())}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-center text-sm text-ink/50">
          No hay productos con stock disponible{filterLabel ? " con este filtro" : ""}.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3">
          {items.flatMap(({ product, variants: productVariants }) =>
            productVariants.map((v) => (
              <div
                key={v.id}
                className="flex flex-col items-center break-inside-avoid rounded-xl border border-gold/25 p-3 text-center"
              >
                <div className="mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
                  {v.image_url ?? product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.image_url ?? product.image_url ?? undefined}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageOff className="h-6 w-6 text-ink/20" aria-hidden />
                  )}
                </div>
                <p className="line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
                {productVariants.length > 1 && <p className="text-xs text-ink/50">{v.color_name}</p>}
                <p className="mt-1 font-mono text-sm font-semibold text-primary">
                  {formatCurrency(v.price_override ?? product.sale_price)}
                </p>
              </div>
            )),
          )}
        </div>
      )}
    </div>
  );
}
