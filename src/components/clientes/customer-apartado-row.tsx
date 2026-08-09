import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RegisterPaymentDialog } from "@/components/ventas/register-payment-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { PaymentStatus } from "@/lib/types/database.types";

export interface CustomerApartadoItem {
  id: string;
  label: string;
  quantity: number;
  delivered: boolean;
}

export interface CustomerApartadoData {
  id: string;
  saleDate: string;
  total: number;
  paid: number;
  balance: number;
  status: PaymentStatus;
  // Qué se entregó y qué falta — mismo detalle que ya se ve en la vista
  // de Apartados de Ventas, para no tener que salir de la ficha a
  // buscarlo.
  items: CustomerApartadoItem[];
}

// No es un <Link> envolviendo toda la fila a propósito: el botón
// "Registrar abono" abre un diálogo, y un botón interactivo anidado
// dentro de un link es el mismo problema de HTML inválido / click
// ambiguo que ya resolvimos en customer-card.tsx con el patrón
// "stretched link" — acá directo se evita anidando cero, el link de
// fecha y el botón son hermanos, no uno dentro del otro.
export function CustomerApartadoRow({ apartado }: { apartado: CustomerApartadoData }) {
  let badgeLabel = "Con saldo pendiente";
  let badgeVariant: "gold" | "sage" | "accent" | "neutral" = "gold";

  if (apartado.status === "cancelado") {
    badgeLabel = "Cancelado";
    badgeVariant = "neutral";
  } else if (apartado.status === "completado") {
    badgeLabel = "Completado";
    badgeVariant = "sage";
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/20 bg-surface p-3">
      <div>
        <div className="flex items-center gap-2">
          <Link
            href={`/ventas/apartados/${apartado.id}`}
            className="text-sm font-medium text-ink hover:underline"
          >
            {formatDate(apartado.saleDate)}
          </Link>
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink/60">
          Total {formatCurrency(apartado.total)} · Abonado {formatCurrency(apartado.paid)}
          {apartado.status !== "cancelado" && (
            <>
              {" "}
              · Saldo <span className="font-semibold text-ink">{formatCurrency(apartado.balance)}</span>
            </>
          )}
        </p>
        {apartado.items.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink/70">
            {apartado.items.map((item) => (
              <li key={item.id} className="flex items-center gap-1.5">
                {item.delivered ? (
                  <Check className="h-3 w-3 shrink-0 text-sage" />
                ) : (
                  <span className="h-3 w-3 shrink-0 rounded-full border border-gold/50" />
                )}
                <span>
                  {item.label} ×{item.quantity}
                  {!item.delivered && <span className="text-ink/50"> — sin entregar</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {apartado.status === "con_abonos" && <RegisterPaymentDialog saleId={apartado.id} />}
    </div>
  );
}
