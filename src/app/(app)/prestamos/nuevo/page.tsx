import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoanForm } from "@/components/prestamos/loan-form";
import { createLoan } from "../actions";

export default async function NuevoPrestamoPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: profiles }] = await Promise.all([
    supabase.from("products").select("id, name").order("name", { ascending: true }),
    supabase.from("profiles").select("id, display_name").not("user_id", "is", null),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/prestamos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a préstamos
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nuevo préstamo</h1>
      <LoanForm products={products ?? []} profiles={profiles ?? []} action={createLoan} />
    </div>
  );
}
