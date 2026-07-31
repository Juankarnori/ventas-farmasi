import Link from "next/link";
import { Plus, HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoanList, type LoanRow } from "@/components/prestamos/loan-list";
import { SaldoNetoCard, type PendingLoanForBalance } from "@/components/prestamos/saldo-neto-card";
import type { ProfileSlot } from "@/lib/types/database.types";

export default async function PrestamosPage() {
  const supabase = await createClient();

  const [{ data: loans }, { data: products }, { data: profiles }] = await Promise.all([
    supabase.from("loans").select("*").order("loan_date", { ascending: false }),
    supabase.from("products").select("id, name"),
    supabase.from("profiles").select("*"),
  ]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const displayNames = {
    mama: profiles?.find((p) => p.slot === "mama")?.display_name ?? "Mamá",
    yo: profiles?.find((p) => p.slot === "yo")?.display_name ?? "Yo",
  } as Record<ProfileSlot, string>;

  const rows: LoanRow[] = (loans ?? []).map((loan) => ({
    id: loan.id,
    productName: productById.get(loan.product_id)?.name ?? "—",
    quantity: loan.quantity,
    fromName: profileById.get(loan.from_profile_id)?.display_name ?? "—",
    toName: profileById.get(loan.to_profile_id)?.display_name ?? "—",
    loanDate: loan.loan_date,
    note: loan.note,
    status: loan.status,
  }));

  const pending = rows.filter((r) => r.status === "pendiente");
  const returned = rows.filter((r) => r.status === "devuelto");

  const balanceInput: PendingLoanForBalance[] = (loans ?? [])
    .filter((l) => l.status === "pendiente")
    .map((l) => ({
      productId: l.product_id,
      productName: productById.get(l.product_id)?.name ?? "—",
      quantity: l.quantity,
      fromSlot: profileById.get(l.from_profile_id)?.slot ?? "mama",
      toSlot: profileById.get(l.to_profile_id)?.slot ?? "yo",
    }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Préstamos</h1>
          <p className="mt-1 text-sm text-ink/60">Productos que se prestan entre las dos.</p>
        </div>
        <Link href="/prestamos/nuevo">
          <Button>
            <Plus className="h-4 w-4" /> Nuevo préstamo
          </Button>
        </Link>
      </div>

      <div className="mt-6">
        <SaldoNetoCard loans={balanceInput} displayNames={displayNames} />
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
