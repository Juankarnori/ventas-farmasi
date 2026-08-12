import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DeleteSaleButton } from "./delete-sale-button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { PaymentMethod, PaymentStatus } from "@/lib/types/database.types";

export interface ApartadoCardData {
  id: string;
  customerName: string;
  sellerName: string;
  saleDate: string;
  total: number;
  paid: number;
  balance: number;
  status: PaymentStatus;
  allDelivered: boolean;
  paymentMethod: PaymentMethod;
  bankNote: string | null;
}

// Ya no es un <Link> envolviendo toda la tarjeta: DeleteSaleButton
// necesita su propio botón con Dialog, y un botón interactivo anidado
// dentro de un <a> es HTML inválido / click ambiguo — mismo patrón
// "stretched link" que ya se usa en CustomerCard/ProspectCard: un <Link>
// absoluto de fondo cubre toda la tarjeta, el botón de eliminar queda
// por encima con más z-index para interceptar su propio click primero.
export function ApartadoCard({ apartado }: { apartado: ApartadoCardData }) {
  const percent =
    apartado.total > 0 ? Math.min(100, Math.round((apartado.paid / apartado.total) * 100)) : 0;

  let badgeLabel = "Con saldo pendiente";
  let badgeVariant: "gold" | "sage" | "accent" | "neutral" = "gold";

  if (apartado.status === "cancelado") {
    badgeLabel = "Cancelado";
    badgeVariant = "neutral";
  } else if (apartado.status === "completado") {
    badgeLabel = apartado.allDelivered ? "Completado y entregado" : "Completado — falta entregar";
    badgeVariant = apartado.allDelivered ? "sage" : "accent";
  }

  return (
    <div className="relative rounded-2xl border border-gold/20 bg-panel/40 p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/ventas/apartados/${apartado.id}`}
        aria-label={`Ver apartado de ${apartado.customerName}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />

      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink">{apartado.customerName}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          <DeleteSaleButton
            saleId={apartado.id}
            paidAmount={apartado.paid}
            compact
            className="relative z-10 rounded-full p-1 text-ink/40 hover:bg-accent/20 hover:text-ink"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        {formatDate(apartado.saleDate)} · {apartado.sellerName} ·{" "}
        {apartado.paymentMethod === "transferencia" ? "🏦 Transferencia" : "💵 Efectivo"}
        {apartado.bankNote && ` (${apartado.bankNote})`}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-ink/50">Total</p>
          <p className="font-mono tabular-nums text-ink">{formatCurrency(apartado.total)}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50">Abonado</p>
          <p className="font-mono tabular-nums text-ink">{formatCurrency(apartado.paid)}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50">Saldo</p>
          {/* Mismo criterio que el badge de arriba: solo se resalta con el
              color fuerte de la marca (ciruela/primary) cuando de verdad
              hay saldo pendiente — completado/cancelado se quedan en el
              tono neutro de siempre. */}
          <p
            className={
              apartado.status === "con_abonos" && apartado.balance > 0
                ? "font-mono tabular-nums font-semibold text-primary"
                : "font-mono tabular-nums font-semibold text-ink"
            }
          >
            {formatCurrency(apartado.balance)}
          </p>
        </div>
      </div>

      {apartado.status !== "cancelado" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}
