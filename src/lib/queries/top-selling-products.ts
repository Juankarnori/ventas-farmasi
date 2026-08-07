import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface TopSellingProduct {
  productId: string;
  productName: string;
  quantity: number;
  profit: number;
}

// Mismo cálculo que ya usaba Finanzas para "Productos más vendidos":
// ventas realmente cobradas (pagado/completado), agregadas por producto
// padre (no por variante/color). Se extrajo acá para que Finanzas e
// Inicio salgan siempre del mismo número — nunca dos cálculos paralelos
// que puedan desincronizarse.
//
// `sellerId` sigue el mismo criterio de privacidad ya establecido en
// Finanzas/Ventas: null = todo el negocio (solo debería pasarse así para
// una admin — quien llama resuelve esa regla antes, como ya hace
// `effectiveUsuaria` en Finanzas), un id = solo esa vendedora.
export async function getTopSellingProducts(
  supabase: SupabaseServerClient,
  { sellerId, desde, hasta, limit = 5 }: { sellerId: string | null; desde?: string; hasta?: string; limit?: number },
): Promise<TopSellingProduct[]> {
  let salesQuery = supabase.from("sales").select("id").in("payment_status", ["pagado", "completado"]);
  if (desde) salesQuery = salesQuery.gte("sale_date", desde);
  if (hasta) salesQuery = salesQuery.lte("sale_date", hasta);
  if (sellerId) salesQuery = salesQuery.eq("seller_profile_id", sellerId);

  const { data: sales } = await salesQuery;
  const saleIds = (sales ?? []).map((s) => s.id);

  if (saleIds.length === 0) return [];

  const [{ data: items }, { data: products }] = await Promise.all([
    supabase.from("sale_items").select("product_id, quantity, profit").in("sale_id", saleIds),
    supabase.from("products").select("id, name"),
  ]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const byProduct = new Map<string, { quantity: number; profit: number }>();

  for (const item of items ?? []) {
    const entry = byProduct.get(item.product_id) ?? { quantity: 0, profit: 0 };
    entry.quantity += item.quantity;
    entry.profit += item.profit;
    byProduct.set(item.product_id, entry);
  }

  return Array.from(byProduct.entries())
    .map(([productId, v]) => ({
      productId,
      productName: productById.get(productId)?.name ?? "—",
      quantity: v.quantity,
      profit: v.profit,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}
