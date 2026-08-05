import Link from "next/link";
import { Plus, ShoppingBag, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/catalogo/product-card";
import { CatalogoFilters } from "@/components/catalogo/catalogo-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; linea?: string }>;
}) {
  const { q, categoria, linea } = await searchParams;
  const supabase = await createClient();

  const [{ data: categories }, { data: lines }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
  ]);

  let query = supabase.from("products").select("*").order("name", { ascending: true });
  if (q) query = query.ilike("name", `%${q}%`);
  if (categoria) query = query.eq("category_id", categoria);
  if (linea) query = query.eq("line_id", linea);

  const { data: products } = await query;

  const productIds = (products ?? []).map((p) => p.id);
  const { data: variants } =
    productIds.length > 0
      ? await supabase
          .from("product_variants")
          .select("id, product_id, color_name, color_hex")
          .in("product_id", productIds)
          .order("color_name", { ascending: true })
      : { data: [] };

  const variantsByProduct = new Map<string, { id: string; color_name: string; color_hex: string | null }[]>();
  for (const v of variants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const lineById = new Map((lines ?? []).map((l) => [l.id, l]));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Catálogo</h1>
          <p className="mt-1 text-sm text-ink/60">Productos Farmasi que vendés.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/catalogo/categorias"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            <Settings2 className="h-4 w-4" /> Categorías
          </Link>
          <Link href="/catalogo/nuevo">
            <Button>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <CatalogoFilters categories={categories ?? []} lines={lines ?? []} />
      </div>

      {products && products.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={{
                ...product,
                category: product.category_id
                  ? (categoryById.get(product.category_id) ?? null)
                  : null,
                line: product.line_id ? (lineById.get(product.line_id) ?? null) : null,
                variants: variantsByProduct.get(product.id) ?? [],
              }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={ShoppingBag}
            title="Todavía no hay productos"
            description="Agregá el primero para empezar a armar el catálogo."
            action={
              <Link href="/catalogo/nuevo">
                <Button size="sm">Nuevo producto</Button>
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
