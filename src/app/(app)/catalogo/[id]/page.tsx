import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { ProductForm } from "@/components/catalogo/product-form";
import type { VariantDefault } from "@/components/catalogo/variants-editor";
import { updateProduct, deleteProduct } from "../actions";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: categories }, { data: product }, { data: variants }, { data: profiles }] =
    await Promise.all([
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", id)
        .order("color_name", { ascending: true }),
      supabase.from("profiles").select("id, display_name"),
    ]);

  if (!product) {
    notFound();
  }

  const variantIds = (variants ?? []).map((v) => v.id);
  const { data: stockRows } =
    variantIds.length > 0
      ? await supabase
          .from("variant_stock")
          .select("variant_id, profile_id, stock")
          .in("variant_id", variantIds)
      : { data: [] };

  const otherProfile = (profiles ?? []).find((p) => p.id !== profile.id) ?? null;

  const defaultVariants: VariantDefault[] = (variants ?? []).map((v) => {
    const mine = (stockRows ?? []).find((s) => s.variant_id === v.id && s.profile_id === profile.id);
    const other = otherProfile
      ? (stockRows ?? []).find((s) => s.variant_id === v.id && s.profile_id === otherProfile.id)
      : undefined;

    return {
      id: v.id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      myStock: mine?.stock ?? 0,
      otherStock: other?.stock ?? 0,
      otherName: otherProfile?.display_name ?? "La otra",
      price_override: v.price_override,
      cost_override: v.cost_override,
      image_url: v.image_url,
    };
  });

  const updateProductWithId = updateProduct.bind(null, id);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/catalogo"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Editar producto</h1>
        <form
          action={async () => {
            "use server";
            await deleteProduct(id);
            redirect("/catalogo");
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink/60 hover:bg-accent/20 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        </form>
      </div>

      <ProductForm
        categories={categories ?? []}
        action={updateProductWithId}
        defaultValues={product}
        defaultVariants={defaultVariants}
      />
    </div>
  );
}
