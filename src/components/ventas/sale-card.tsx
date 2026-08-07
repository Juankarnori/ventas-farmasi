import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

export interface SaleCardData {
  id: string;
  saleDate: string;
  customerName: string | null;
  sellerName: string;
  products: { label: string; quantity: number }[];
  total: number;
  profit: number;
}

// Mismo lenguaje visual que ApartadoCard (tamaño, bordes, tipografía,
// espaciado) — Ventas y Apartados tienen que sentirse la misma familia
// de tarjetas, no dos estilos distintos conviviendo en la misma sección.
// A diferencia de Apartados, esta no es un link: todavía no existe una
// vista de detalle para una venta de contado (a diferencia de un
// apartado, que sí tiene acciones — registrar abono, marcar entregado —
// que ameritan su propia página).
export function SaleCard({ sale }: { sale: SaleCardData }) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-panel/40 p-4 shadow-sm">
      <p className="font-medium text-ink">{sale.customerName ?? "Venta de mostrador"}</p>
      <p className="mt-1 text-xs text-ink/50">
        {formatDate(sale.saleDate)} · {sale.sellerName}
      </p>

      <p className="mt-3 text-sm text-ink/70">
        {sale.products.map((p) => `${p.label} ×${p.quantity}`).join(", ")}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-ink/50">Total</p>
          <p className="font-mono tabular-nums text-ink">{formatCurrency(sale.total)}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50">Ganancia</p>
          <p className="font-mono tabular-nums font-semibold text-ink">{formatCurrency(sale.profit)}</p>
        </div>
      </div>
    </div>
  );
}
