import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopSellingProduct } from "@/lib/queries/top-selling-products";

export function TopSellersCard({ products }: { products: TopSellingProduct[] }) {
  return (
    <Card className="p-0">
      <CardHeader className="px-5 pt-5">
        <CardTitle>Productos más vendidos</CardTitle>
        <Link href="/finanzas" className="text-xs font-medium text-primary hover:underline">
          Ver en Finanzas
        </Link>
      </CardHeader>
      {products.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink/50">Todavía no hay ventas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10 pb-2">
          {products.map((p, i) => (
            <li key={p.productId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="text-ink">
                <span className="text-ink/40">{i + 1}.</span> {p.productName}
              </span>
              <span className="font-mono tabular-nums text-ink/70">{p.quantity} u.</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
