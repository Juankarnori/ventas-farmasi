import { Hourglass } from "lucide-react";

// Aviso reutilizable de "esta venta se completó sin stock suficiente y
// todavía le falta algo por comprar" — mismo texto/ícono en la tarjeta de
// Ventas, la de Apartados, y el detalle de las dos. Desaparece solo (sin
// ninguna acción manual) en cuanto mark_order_received reconcilia el
// pendiente — ver 0046_pending_purchase.sql.
export function PendingPurchaseNotice({ items }: { items: { label: string; quantity: number }[] }) {
  if (items.length === 0) return null;

  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-primary">
      <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Pendiente de comprar: {items.map((i) => `${i.quantity} × ${i.label}`).join(", ")}
      </span>
    </p>
  );
}
