import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/catalogo/product-form";
import { createProduct } from "../actions";

export default async function NuevoProductoPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: lines }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/catalogo"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nuevo producto</h1>
      <ProductForm
        categories={categories ?? []}
        lines={lines ?? []}
        action={createProduct}
        submitLabel="Crear producto"
      />
    </div>
  );
}
