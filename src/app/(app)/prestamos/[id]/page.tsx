import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { LoanEditPanel, LoanSettlementEditor, type LoanEditData } from "@/components/prestamos/loan-edit-panel";
import type { LoanableProduct } from "@/components/prestamos/loan-form";
import { variantLabel } from "@/lib/utils/variant-label";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { loanDebtAmount } from "@/lib/utils/loan-debt";
import { updateLoan, updateLoanSettlement } from "../actions";

const STATUS_LABEL = {
  pendiente: "Pendiente",
  devuelto: "Devuelto",
  vendido: "Vendido",
} as const;

export default async function PrestamoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: loan } = await supabase.from("loans").select("*").eq("id", id).maybeSingle();

  if (!loan) {
    notFound();
  }

  const [{ data: allProducts }, { data: allVariants }, { data: categories }, { data: lines }, { data: profiles }] =
    await Promise.all([
      supabase.from("products").select("id, name, category_id, line_id").order("name", { ascending: true }),
      supabase
        .from("product_variants")
        .select("id, product_id, color_name")
        .order("color_name", { ascending: true }),
      supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
      supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
      supabase.from("profiles").select("id, display_name"),
    ]);

  const variantsByProduct = new Map<string, typeof allVariants>();
  for (const v of allVariants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const products: LoanableProduct[] = (allProducts ?? [])
    .map((p) => ({
      ...p,
      variants: (variantsByProduct.get(p.id) ?? []).map((v) => ({ id: v.id, color_name: v.color_name })),
    }))
    .filter((p) => p.variants.length > 0);

  const productById = new Map((allProducts ?? []).map((p) => [p.id, p]));
  const variantById = new Map((allVariants ?? []).map((v) => [v.id, v]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const productName = productById.get(loan.product_id)?.name ?? "—";
  const colorName = variantById.get(loan.variant_id)?.color_name;
  const productLabel = colorName ? variantLabel(productName, colorName) : productName;
  const fromName = profileById.get(loan.from_profile_id)?.display_name ?? "—";
  const toName = profileById.get(loan.to_profile_id)?.display_name ?? "—";

  const editData: LoanEditData = {
    id: loan.id,
    productLabel,
    variantId: loan.variant_id,
    quantity: loan.quantity,
    fromName,
    toName,
    loanDate: loan.loan_date,
    note: loan.note,
    valuationType: loan.valuation_type,
  };

  const updateAction = updateLoan.bind(null, loan.id);
  const settlementAction = updateLoanSettlement.bind(null, loan.id);
  const debtAmount = loanDebtAmount(loan);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/prestamos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a préstamos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl text-ink">{productLabel}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {formatDate(loan.loan_date)} · {fromName} → {toName}
          </p>
        </div>
        <Badge variant={loan.status === "pendiente" ? "gold" : loan.status === "devuelto" ? "sage" : "accent"}>
          {STATUS_LABEL[loan.status]}
        </Badge>
      </div>

      {loan.status === "pendiente" && (
        <LoanEditPanel loan={editData} products={products} categories={categories ?? []} lines={lines ?? []} action={updateAction} />
      )}

      {loan.status === "devuelto" && (
        <div className="mt-6 rounded-xl border border-gold/20 bg-panel/30 p-4 text-sm text-ink/70">
          Este préstamo ya se devolvió — no hay nada que pagar ni editar.
        </div>
      )}

      {loan.status === "vendido" && (
        <>
          <div className="mt-6 rounded-xl border border-gold/20 bg-panel/30 p-4 text-sm text-ink/70">
            {loan.quantity} unidad{loan.quantity === 1 ? "" : "es"} — se vendió en vez de devolverse, así
            que {toName} le debe a {fromName}{" "}
            <span className="font-mono font-semibold text-ink">{formatCurrency(debtAmount)}</span>{" "}
            ({loan.valuation_type === "pvp" ? "a precio de venta" : "al costo"}).
            {loan.debt_settled_at && " Esta deuda ya está liquidada."}
          </div>
          <LoanSettlementEditor
            loanId={loan.id}
            settlementMethod={loan.settlement_method}
            settlementBankNote={loan.settlement_bank_note}
            action={settlementAction}
          />
        </>
      )}
    </div>
  );
}
