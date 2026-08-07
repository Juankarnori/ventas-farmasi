import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";

export interface TopCustomerRow {
  id: string;
  name: string;
  totalSpent: number;
}

export function TopCustomersCard({ customers }: { customers: TopCustomerRow[] }) {
  return (
    <Card className="p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle>Mejores clientas</CardTitle>
        <Link href="/clientes" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      {customers.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink/50">Todavía no hay clientas registradas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10 pb-2">
          {customers.map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-ink">
                <span className="text-ink/40">{i + 1}.</span> {c.name}
              </span>
              <span className="font-mono tabular-nums text-ink/70">{formatCurrency(c.totalSpent)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
