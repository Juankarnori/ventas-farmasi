import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { computeNetDebt, type DebtEntry } from "@/lib/utils/loan-debt";
import { settleAllDebts } from "@/app/(app)/prestamos/actions";
import type { ProfileSlot } from "@/lib/types/database.types";

export function MonetaryDebtCard({
  debts,
  displayNames,
}: {
  debts: DebtEntry[];
  displayNames: Record<ProfileSlot, string>;
}) {
  const net = computeNetDebt(debts);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo monetario pendiente</CardTitle>
      </CardHeader>
      {net === 0 ? (
        <p className="text-sm text-ink/50">No hay deuda pendiente por productos vendidos.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">
            {net > 0 ? displayNames.yo : displayNames.mama} le debe a{" "}
            {net > 0 ? displayNames.mama : displayNames.yo}{" "}
            <span className="font-mono tabular-nums text-ink">{formatCurrency(Math.abs(net))}</span>{" "}
            por productos prestados que vendió en vez de devolver.
          </p>
          <form action={settleAllDebts}>
            <Button type="submit" size="sm" variant="outline">
              Marcar como liquidado
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
