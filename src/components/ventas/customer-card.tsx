import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";

export interface CustomerCardData {
  id: string;
  name: string;
  phone: string | null;
  totalSpent: number;
  purchaseCount: number;
}

export function CustomerCard({ customer }: { customer: CustomerCardData }) {
  return (
    <Link
      href={`/ventas/clientes/${customer.id}`}
      className="block rounded-2xl border border-gold/20 bg-panel/40 p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <p className="font-medium text-ink">{customer.name}</p>
      <p className="mt-0.5 text-xs text-ink/50">{customer.phone ?? "Sin teléfono"}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-ink/50">Total gastado</p>
          <p className="font-mono tabular-nums font-semibold text-ink">
            {formatCurrency(customer.totalSpent)}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink/50">Compras</p>
          <p className="font-mono tabular-nums text-ink">{customer.purchaseCount}</p>
        </div>
      </div>
    </Link>
  );
}
