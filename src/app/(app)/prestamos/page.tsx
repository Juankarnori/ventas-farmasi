import Link from "next/link";
import { Plus, HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoanList, type LoanRow } from "@/components/prestamos/loan-list";
import { SaldoNetoCard, type PendingLoanForBalance } from "@/components/prestamos/saldo-neto-card";
import { MonetaryDebtCard } from "@/components/prestamos/monetary-debt-card";
import { variantLabel } from "@/lib/utils/variant-label";
import { loanDisplayAmount, loanUnitValue, type DebtEntry } from "@/lib/utils/loan-debt";

export default async function PrestamosPage() {
  const supabase = await createClient();

  const [{ data: loans }, { data: products }, { data: variants }, { data: profiles }] = await Promise.all([
    supabase.from("loans").select("*").order("loan_date", { ascending: false }),
    supabase.from("products").select("id, name"),
    supabase.from("product_variants").select("id, color_name"),
    supabase.from("profiles").select("*"),
  ]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  function labelFor(loan: { product_id: string; variant_id: string }) {
    const productName = productById.get(loan.product_id)?.name ?? "—";
    const colorName = variantById.get(loan.variant_id)?.color_name;
    return colorName ? variantLabel(productName, colorName) : productName;
  }

  const rows: LoanRow[] = (loans ?? []).map((loan) => ({
    id: loan.id,
    productName: labelFor(loan),
    quantity: loan.quantity,
    fromName: profileById.get(loan.from_profile_id)?.display_name ?? "—",
    toName: profileById.get(loan.to_profile_id)?.display_name ?? "—",
    loanDate: loan.loan_date,
    note: loan.note,
    status: loan.status,
    unitValue: loanUnitValue({
      valuationType: loan.valuation_type,
      unitCost: loan.unit_cost,
      unitPrice: loan.unit_price,
      customPrice: loan.custom_price,
    }),
    // Una vez que se registró de verdad cómo se pagó, ESE monto es la
    // fuente de verdad — no el estimado (ver loanDisplayAmount).
    debtAmount: loanDisplayAmount(loan),
    debtSettled: loan.debt_settled_at !== null,
  }));

  const pending = rows.filter((r) => r.status === "pendiente");
  const returned = rows.filter((r) => r.status === "devuelto");
  const sold = rows.filter((r) => r.status === "vendido");

  const balanceInput: PendingLoanForBalance[] = (loans ?? [])
    .filter((l) => l.status === "pendiente")
    .map((l) => ({
      variantId: l.variant_id,
      label: labelFor(l),
      quantity: l.quantity,
      fromProfileId: l.from_profile_id,
      fromName: profileById.get(l.from_profile_id)?.display_name ?? "—",
      toProfileId: l.to_profile_id,
      toName: profileById.get(l.to_profile_id)?.display_name ?? "—",
    }));

  const debts: DebtEntry[] = (loans ?? [])
    .filter((l) => l.status === "vendido" && l.debt_settled_at === null)
    .map((l) => ({
      fromProfileId: l.from_profile_id,
      fromName: profileById.get(l.from_profile_id)?.display_name ?? "—",
      toProfileId: l.to_profile_id,
      toName: profileById.get(l.to_profile_id)?.display_name ?? "—",
      amount: loanDisplayAmount(l),
    }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Préstamos</h1>
          <p className="mt-1 text-sm text-ink/60">Productos que se prestan entre el equipo.</p>
        </div>
        <Link href="/prestamos/nuevo">
          <Button>
            <Plus className="h-4 w-4" /> Nuevo préstamo
          </Button>
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <SaldoNetoCard loans={balanceInput} />
        <MonetaryDebtCard debts={debts} />
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Todavía no hay préstamos"
            description="Registrá cuando se presten un producto entre ustedes."
            action={
              <Link href="/prestamos/nuevo">
                <Button size="sm">Nuevo préstamo</Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            <Card className="p-0">
              <CardHeader className="px-5 pt-5">
                <CardTitle>Pendientes</CardTitle>
              </CardHeader>
              <LoanList loans={pending} />
            </Card>
            <Card className="p-0">
              <CardHeader className="px-5 pt-5">
                <CardTitle>Vendidos</CardTitle>
              </CardHeader>
              <LoanList loans={sold} />
            </Card>
            <Card className="p-0">
              <CardHeader className="px-5 pt-5">
                <CardTitle>Devueltos</CardTitle>
              </CardHeader>
              <LoanList loans={returned} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
