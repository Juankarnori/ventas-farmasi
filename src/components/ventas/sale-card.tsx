import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeleteSaleButton } from "./delete-sale-button";
import { PendingPurchaseNotice } from "@/components/shared/pending-purchase-notice";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { PaymentMethod, PaymentStatus } from "@/lib/types/database.types";

export interface SaleCardData {
  id: string;
  saleDate: string;
  customerName: string | null;
  sellerName: string;
  products: { label: string; quantity: number }[];
  total: number;
  profit: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  bankNote: string | null;
  // Suma de sale_payments — 0 para una venta de contado normal (esas
  // nunca pasan por ahí); >0 solo si esta venta llegó a ser un apartado
  // con abonos, aunque ya esté 'completado'. Lo único que necesita
  // DeleteSaleButton para decidir qué advertencia mostrar.
  paidAmount: number;
  // Renglones que se completaron sin stock suficiente (ver
  // pending_purchase_quantity) — vacío la mayoría de las veces.
  pendingItems: { label: string; quantity: number }[];
}

// Mismo lenguaje visual que ApartadoCard (tamaño, bordes, tipografía,
// espaciado) — Ventas y Apartados tienen que sentirse la misma familia
// de tarjetas, no dos estilos distintos conviviendo en la misma sección.
export function SaleCard({ sale }: { sale: SaleCardData }) {
  // Una venta de contado ('pagado') se edita completa (productos +
  // método de pago) en su propia página. Un apartado que ya se completó
  // ('completado', también listado acá en Ventas) sigue las mismas
  // restricciones que cualquier apartado — no se tocan productos, ver
  // update_sale_items en 0025 — así que su edición vive en la ficha de
  // Apartados, que ya existe y ya tiene todo el contexto de abonos.
  const editHref = sale.paymentStatus === "pagado" ? `/ventas/${sale.id}` : `/ventas/apartados/${sale.id}`;

  return (
    <div className="rounded-2xl border border-gold/20 bg-panel/40 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink">{sale.customerName ?? "Venta de mostrador"}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={editHref}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Link>
          <DeleteSaleButton saleId={sale.id} paidAmount={sale.paidAmount} />
        </div>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        {formatDate(sale.saleDate)} · {sale.sellerName}
      </p>

      <ul className="mt-3 flex flex-col gap-0.5 text-sm text-ink/70">
        {sale.products.map((p) => (
          <li key={p.label}>
            {p.label} ×{p.quantity}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={sale.paymentMethod === "transferencia" ? "sage" : "gold"}>
          {sale.paymentMethod === "transferencia" ? "🏦 Transferencia" : "💵 Efectivo"}
        </Badge>
        {sale.bankNote && <span className="text-xs text-ink/50">{sale.bankNote}</span>}
      </div>

      <PendingPurchaseNotice items={sale.pendingItems} />

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
