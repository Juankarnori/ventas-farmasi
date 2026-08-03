import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoanForm } from "@/components/prestamos/loan-form";
import { createLoan } from "../actions";

export default async function NuevoPrestamoPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: variants }, { data: profiles }] = await Promise.all([
    supabase.from("products").select("id, name").order("name", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, product_id, color_name")
      .order("color_name", { ascending: true }),
    supabase.from("profiles").select("id, display_name").not("user_id", "is", null),
  ]);

  const variantsByProduct = new Map<string, typeof variants>();
  for (const v of variants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const loanableProducts = (products ?? [])
    .map((p) => ({ ...p, variants: variantsByProduct.get(p.id) ?? [] }))
    .filter((p) => p.variants.length > 0);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/prestamos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a préstamos
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nuevo préstamo</h1>
      <LoanForm products={loanableProducts} profiles={profiles ?? []} action={createLoan} />
    </div>
  );
}
