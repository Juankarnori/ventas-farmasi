import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";

export interface CustomerCardData {
  id: string;
  name: string;
  phone: string | null;
  totalSpent: number;
  purchaseCount: number;
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
        href={`/ventas/clientes/${customer.id}`}
        aria-label={`Ver ficha de ${customer.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />

      <p className="font-medium text-ink">{customer.name}</p>
      <div className="mt-0.5 flex items-center gap-1">
        <p className="text-xs text-ink/50">{customer.phone ?? "Sin teléfono"}</p>
        <WhatsAppButton phone={customer.phone} className="relative z-10 h-5 w-5" />
      </div>

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
