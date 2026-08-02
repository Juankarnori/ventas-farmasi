import Link from "next/link";
import { AlertTriangle, HandCoins } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface LowStockItem {
  id: string;
  name: string;
  stock: number;
}

export function AlertsPanel({
  lowStockProducts,
  pendingLoansCount,
}: {
  lowStockProducts: LowStockItem[];
  pendingLoansCount: number;
}) {
  if (lowStockProducts.length === 0 && pendingLoansCount === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-4">
        {lowStockProducts.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
              <AlertTriangle className="h-4 w-4 text-accent" /> Stock bajo
            </div>
            <ul className="flex flex-wrap gap-2">
              {lowStockProducts.map((p) => (
                <li key={p.id}>
                  <Link href={`/catalogo/${p.id}`}>
                    <Badge variant="accent">
                      {p.name} · {p.stock} u.
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pendingLoansCount > 0 && (
          <div>
            <Link
              href="/prestamos"
              className="flex items-center gap-2 text-sm font-medium text-ink hover:underline"
            >
              <HandCoins className="h-4 w-4 text-gold" />
              {pendingLoansCount} préstamo{pendingLoansCount === 1 ? "" : "s"} pendiente
              {pendingLoansCount === 1 ? "" : "s"} de devolver
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
