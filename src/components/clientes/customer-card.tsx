import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";

export interface CustomerCardData {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  totalSpent: number;
  purchaseCount: number;
  // Suma de saldo de apartados con abonos pendientes. `undefined`/0 = no
  // debe nada — en ese caso no se muestra el badge (ver más abajo).
  pendingBalance?: number;
}

export function CustomerCard({ customer }: { customer: CustomerCardData }) {
  return (
    // La tarjeta entera es clickeable (patrón "stretched link"), pero el
    // botón de WhatsApp necesita su propio <a> — un <a> no puede anidarse
    // dentro de otro <a> (HTML inválido, comportamiento de click
    // ambiguo). Por eso este ya no es un <Link> envolviendo todo: es un
    // <div> con un <Link> absoluto de fondo (cubre toda la tarjeta) y el
    // botón de WhatsApp por encima con z-index más alto, así intercepta
    // su propio click en vez de disparar la navegación de la tarjeta.
    <div className="relative rounded-2xl border border-gold/20 bg-panel/40 p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/clientes/${customer.id}`}
        aria-label={`Ver ficha de ${customer.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />

      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink">{customer.name}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Sin z-index/relative a propósito, a diferencia del botón de
              WhatsApp/editar: este badge no es interactivo, no necesita
              ganarle el click al <Link> de fondo. */}
          {!!customer.pendingBalance && (
            <Badge variant="gold">Saldo pendiente: {formatCurrency(customer.pendingBalance)}</Badge>
          )}
          {/* Mismo motivo que WhatsAppButton: necesita su propio <Link>
              con más z-index para interceptar el click antes que el de
              fondo — así se puede editar sin tener que entrar primero a
              la ficha. */}
          <Link
            href={`/clientes/${customer.id}?edit=1`}
            aria-label={`Editar ${customer.name}`}
            className="relative z-10 rounded-full p-1 text-ink/40 hover:bg-primary/10 hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <p className="text-xs text-ink/50">{customer.phone ?? "Sin teléfono"}</p>
        <WhatsAppButton phone={customer.phone} className="relative z-10 h-5 w-5" />
      </div>

      {/* Solo si hay notas cargadas — nada de placeholder "Sin notas" que
          ensucie la tarjeta cuando no hay nada que mostrar. */}
      {customer.notes && <p className="mt-2 line-clamp-3 text-xs text-ink/60">{customer.notes}</p>}

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
    </div>
  );
}
