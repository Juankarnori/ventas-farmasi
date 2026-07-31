import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileSlot } from "@/lib/types/database.types";

export interface PendingLoanForBalance {
  productId: string;
  productName: string;
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
  // Neto por producto: positivo = "yo" le debe a "mama" ese producto,
  // negativo = "mama" le debe a "yo". Solo tiene sentido netear dentro
  // del mismo producto (2 lápices labiales prestados no cancelan un
  // shampoo prestado en la otra dirección).
  const netByProduct = new Map<string, number>();
  for (const loan of loans) {
    const sign = loan.toSlot === "yo" ? 1 : -1;
    netByProduct.set(loan.productId, (netByProduct.get(loan.productId) ?? 0) + sign * loan.quantity);
  }

  const productNameById = new Map(loans.map((l) => [l.productId, l.productName]));
  const balances = Array.from(netByProduct.entries())
    .filter(([, net]) => net !== 0)
    .map(([productId, net]) => ({
      productId,
      productName: productNameById.get(productId) ?? "—",
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
            <li key={b.productId} className="flex items-center justify-between text-sm">
              <span className="text-ink">
                {b.net > 0 ? displayNames.yo : displayNames.mama} le debe a{" "}
                {b.net > 0 ? displayNames.mama : displayNames.yo}
              </span>
              <span className="font-mono tabular-nums text-ink/70">
                {Math.abs(b.net)} × {b.productName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
