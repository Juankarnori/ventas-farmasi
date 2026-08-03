import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/catalogo/product-form";
import { updateProduct, deleteProduct } from "../actions";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: categories }, { data: product }, { data: variants }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("color_name", { ascending: true }),
  ]);

  if (!product) {
    notFound();
  }

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
        defaultVariants={variants ?? []}
      />
    </div>
  );
}
