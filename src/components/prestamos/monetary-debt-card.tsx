import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { computeNetDebts, type DebtEntry } from "@/lib/utils/loan-debt";
import { settleAllDebts } from "@/app/(app)/prestamos/actions";

// Mismo lenguaje visual que las tarjetas de Clientes/Ventas (borde,
// redondeo, sombra, espaciado) — para que esta sección se sienta parte de
// la misma familia visual en vez de una lista de texto suelta.
function DebtCard({ debtorName, creditorName, amount }: { debtorName: string; creditorName: string; amount: number }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-panel/40 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink">
          {debtorName} → {creditorName}
        </p>
        <Wallet className="h-4 w-4 shrink-0 text-gold" />
      </div>
      <p className="mt-1 text-xs text-ink/50">
        {debtorName} le debe a {creditorName}
      </p>
      <p className="mt-3 font-mono text-lg tabular-nums font-semibold text-ink">
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

export function MonetaryDebtCard({ debts }: { debts: DebtEntry[] }) {
  const lines = computeNetDebts(debts);

  if (lines.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-ink">Saldo monetario pendiente</h2>
        {/* Botón siempre visible acá, no escondido al pie de una lista —
            reutiliza settle_loan_debts tal cual (liquida TODAS las deudas
            'vendido' pendientes de una vez, no hay liquidación parcial por
            par). */}
        <form action={settleAllDebts}>
          <Button type="submit" size="sm" variant="outline">
            Marcar todo como liquidado
          </Button>
        </form>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lines.map((line) => (
          <DebtCard
            key={`${line.debtorId}:${line.creditorId}`}
            debtorName={line.debtorName}
            creditorName={line.creditorName}
            amount={line.amount}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink/50">Por productos prestados que se vendieron en vez de devolver.</p>
    </div>
  );
}
