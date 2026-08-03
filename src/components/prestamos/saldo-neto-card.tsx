import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileSlot } from "@/lib/types/database.types";

export interface PendingLoanForBalance {
  variantId: string;
  label: string;
  quantity: number;
  fromSlot: ProfileSlot;
  toSlot: ProfileSlot;
}

export function SaldoNetoCard({
  loans,
  displayNames,
}: {
  loans: PendingLoanForBalance[];
  displayNames: Record<ProfileSlot, string>;
}) {
  // Neto por variante: positivo = "yo" le debe a "mama" ese color,
  // negativo = "mama" le debe a "yo". Solo tiene sentido netear dentro
  // de la misma variante (2 labiales "Coral" prestados no cancelan 2
  // labiales "Nude" prestados en la otra dirección, ni un shampoo).
  const netByVariant = new Map<string, number>();
  for (const loan of loans) {
    const sign = loan.toSlot === "yo" ? 1 : -1;
    netByVariant.set(loan.variantId, (netByVariant.get(loan.variantId) ?? 0) + sign * loan.quantity);
  }

  const labelByVariant = new Map(loans.map((l) => [l.variantId, l.label]));
  const balances = Array.from(netByVariant.entries())
    .filter(([, net]) => net !== 0)
    .map(([variantId, net]) => ({
      variantId,
      label: labelByVariant.get(variantId) ?? "—",
      net,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Quién le debe qué a quién?</CardTitle>
      </CardHeader>
      {balances.length === 0 ? (
        <p className="text-sm text-ink/50">No hay préstamos pendientes de devolver.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {balances.map((b) => (
            <li key={b.variantId} className="flex items-center justify-between text-sm">
              <span className="text-ink">
                {b.net > 0 ? displayNames.yo : displayNames.mama} le debe a{" "}
                {b.net > 0 ? displayNames.mama : displayNames.yo}
              </span>
              <span className="font-mono tabular-nums text-ink/70">
                {Math.abs(b.net)} × {b.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
