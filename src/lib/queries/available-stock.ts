import type { createClient } from "@/lib/supabase/server";
import { variantLabel } from "@/lib/utils/variant-label";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface AvailableStockItem {
  variantId: string;
  productId: string;
  label: string;
  imageUrl: string | null;
  stock: number;
}

// Variantes con stock disponible > 0 — mismo criterio de privacidad que
// Inventario: "mio" es lo que tiene en `variant_stock` quien mira;
// "todo" es el total del negocio. `product_variants.stock` ya es un
// espejo (mantenido por trigger desde 0015_per_user_stock.sql) de la
// suma de `variant_stock` de todas las usuarias, así que para "todo" no
// hace falta agregar nada a mano — se lee directo de ahí.
export async function getAvailableStock(
  supabase: SupabaseServerClient,
  { profileId, scope, limit = 24 }: { profileId: string; scope: "mio" | "todo"; limit?: number },
): Promise<AvailableStockItem[]> {
  const { data: products } = await supabase.from("products").select("id, name, image_url");
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  if (scope === "todo") {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, product_id, color_name, image_url, stock")
      .gt("stock", 0)
      .order("stock", { ascending: false })
      .limit(limit);

    return (variants ?? []).map((v) => {
      const product = productById.get(v.product_id);
      return {
        variantId: v.id,
        productId: v.product_id,
        label: variantLabel(product?.name ?? "—", v.color_name),
        imageUrl: v.image_url ?? product?.image_url ?? null,
        stock: v.stock,
      };
    });
  }

  const { data: ownStock } = await supabase
    .from("variant_stock")
    .select("variant_id, stock")
    .eq("profile_id", profileId)
    .gt("stock", 0)
    .order("stock", { ascending: false })
    .limit(limit);

  const variantIds = (ownStock ?? []).map((s) => s.variant_id);
  if (variantIds.length === 0) return [];

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, product_id, color_name, image_url")
    .in("id", variantIds);
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  return (ownStock ?? [])
    .map((s) => {
      const variant = variantById.get(s.variant_id);
      if (!variant) return null;
      const product = productById.get(variant.product_id);
      return {
        variantId: variant.id,
        productId: variant.product_id,
        label: variantLabel(product?.name ?? "—", variant.color_name),
        imageUrl: variant.image_url ?? product?.image_url ?? null,
        stock: s.stock,
      };
    })
    .filter((item): item is AvailableStockItem => item !== null);
}
