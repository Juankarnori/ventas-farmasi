import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { SaleForm } from "@/components/ventas/sale-form";
import { createSale, createApartado } from "../actions";

export default async function NuevaVentaPage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const [{ data: products }, { data: variants }, { data: myStock }] = await Promise.all([
    supabase.from("products").select("id, name, sale_price").order("name", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, product_id, color_name, price_override")
      .order("color_name", { ascending: true }),
    supabase.from("variant_stock").select("variant_id, stock").eq("profile_id", profile.id),
  ]);

  const myStockByVariant = new Map((myStock ?? []).map((s) => [s.variant_id, s.stock]));
  const variantsWithStock = (variants ?? []).map((v) => ({
    ...v,
    stock: myStockByVariant.get(v.id) ?? 0,
  }));

  const variantsByProduct = new Map<string, typeof variantsWithStock>();
  for (const v of variantsWithStock) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const sellableProducts = (products ?? [])
    .map((p) => ({ ...p, variants: variantsByProduct.get(p.id) ?? [] }))
    .filter((p) => p.variants.length > 0);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/ventas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a ventas
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nueva venta</h1>
      <SaleForm products={sellableProducts} saleAction={createSale} apartadoAction={createApartado} />
    </div>
  );
}
