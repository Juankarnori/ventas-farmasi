import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export interface PendingLoanForBalance {
  variantId: string;
  label: string;
  quantity: number;
  fromProfileId: string;
  fromName: string;
  toProfileId: string;
  toName: string;
}

interface PairAcc {
  variantId: string;
  label: string;
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  net: number;
}

export function SaldoNetoCard({ loans }: { loans: PendingLoanForBalance[] }) {
  // Neto por variante Y por par de personas: solo tiene sentido netear
  // dentro de la misma variante (2 labiales "Coral" prestados no cancelan
  // 2 labiales "Nude", ni un shampoo) Y dentro del mismo par (un préstamo
  // entre Ana y Carlos no cancela otro entre Ana y Sofía) — con más de 2
  // personas puede haber varios pares distintos a la vez.
  const byKey = new Map<string, PairAcc>();

  for (const loan of loans) {
    const [aId, aName, bId, bName] =
      loan.fromProfileId < loan.toProfileId
        ? [loan.fromProfileId, loan.fromName, loan.toProfileId, loan.toName]
        : [loan.toProfileId, loan.toName, loan.fromProfileId, loan.fromName];

    const key = `${loan.variantId}:${aId}:${bId}`;
    const acc = byKey.get(key) ?? { variantId: loan.variantId, label: loan.label, aId, aName, bId, bName, net: 0 };
    const sign = loan.fromProfileId === aId ? 1 : -1;
    acc.net += sign * loan.quantity;
    byKey.set(key, acc);
  }

  const balances = Array.from(byKey.entries())
    .filter(([, acc]) => acc.net !== 0)
    .map(([key, acc]) => ({
      key,
      label: acc.label,
      quantity: Math.abs(acc.net),
      debtorName: acc.net > 0 ? acc.bName : acc.aName,
      creditorName: acc.net > 0 ? acc.aName : acc.bName,
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
            <li key={b.key} className="flex items-center justify-between text-sm">
              <span className="text-ink">
                {b.debtorName} le debe a {b.creditorName}
              </span>
              <span className="font-mono tabular-nums text-ink/70">
                {b.quantity} × {b.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
