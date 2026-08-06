import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { computeNetDebts, type DebtEntry } from "@/lib/utils/loan-debt";
import { settleAllDebts } from "@/app/(app)/prestamos/actions";

export function MonetaryDebtCard({ debts }: { debts: DebtEntry[] }) {
  const lines = computeNetDebts(debts);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo monetario pendiente</CardTitle>
      </CardHeader>
      {lines.length === 0 ? (
        <p className="text-sm text-ink/50">No hay deuda pendiente por productos vendidos.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <li
                key={`${line.debtorId}:${line.creditorId}`}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink"
              >
                <span>
                  {line.debtorName} le debe a {line.creditorName}
                </span>
                <span className="font-mono tabular-nums text-ink">
                  {formatCurrency(line.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/50">Por productos prestados que se vendieron en vez de devolver.</p>
          <form action={settleAllDebts}>
            <Button type="submit" size="sm" variant="outline">
              Marcar todo como liquidado
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
