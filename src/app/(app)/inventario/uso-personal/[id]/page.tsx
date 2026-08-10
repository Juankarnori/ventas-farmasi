import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonalUseEditForm } from "@/components/inventario/personal-use-edit-form";
import type { PersonalUseProduct } from "@/components/inventario/personal-use-form";
import { variantLabel } from "@/lib/utils/variant-label";
import { updatePersonalUse } from "../../actions";

export default async function EditarUsoPersonalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: entry } = await supabase.from("personal_use").select("*").eq("id", id).maybeSingle();

  if (!entry) {
    notFound();
  }

  // Solo quien registró el uso personal (o una admin) puede editarlo —
  // mismo chequeo que hace update_personal_use del lado del servidor,
  // repetido acá para no mostrarle siquiera el formulario a quien no
  // puede guardarlo.
  const canEdit = entry.profile_id === profile.id || profile.is_admin;

  // Catálogo completo (no filtrado por stock disponible): a diferencia
  // del alta, acá se puede estar editando un registro de un producto/
  // color que ya no tiene stock propio — mismo criterio que
  // LoanEditPanel. El número de stock por variante no se muestra en modo
  // edición, así que no hace falta calcularlo bien; queda en 0.
  const [{ data: allProducts }, { data: allVariants }, { data: categories }, { data: lines }] = await Promise.all([
    supabase.from("products").select("id, name, category_id, line_id").order("name", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, product_id, color_name, sku")
      .order("color_name", { ascending: true }),
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
    supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
  ]);

  const variantsByProduct = new Map<string, typeof allVariants>();
  for (const v of allVariants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const products: PersonalUseProduct[] = (allProducts ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    line_id: p.line_id,
    variants: (variantsByProduct.get(p.id) ?? []).map((v) => ({
      id: v.id,
      color_name: v.color_name,
      sku: v.sku,
      stock: 0,
    })),
  }));

  const productById = new Map((allProducts ?? []).map((p) => [p.id, p]));
  const variantById = new Map((allVariants ?? []).map((v) => [v.id, v]));
  const productName = productById.get(entry.product_id)?.name ?? "—";
  const colorName = variantById.get(entry.variant_id)?.color_name;
  const productLabel = colorName ? variantLabel(productName, colorName) : productName;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/inventario/uso-personal"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Uso personal
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Editar: {productLabel}</CardTitle>
        </CardHeader>

        {canEdit ? (
          <PersonalUseEditForm
            entryId={entry.id}
            products={products}
            categories={categories ?? []}
            lines={lines ?? []}
            defaults={{
              variantId: entry.variant_id,
              quantity: entry.quantity,
              usedAt: entry.used_at,
              note: entry.note,
              reimbursedAmount: entry.reimbursed_amount,
              reimbursedNote: entry.reimbursed_note,
            }}
            action={updatePersonalUse}
          />
        ) : (
          <p className="text-sm text-ink/60">Solo quien registró este uso personal puede editarlo.</p>
        )}
      </Card>
    </div>
  );
}
