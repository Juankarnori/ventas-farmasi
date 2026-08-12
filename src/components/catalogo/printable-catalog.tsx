import { ImageOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

// Diseño compartido de la vista imprimible (@media print) — mismo header
// + grilla de tarjetas para /imprimir/catalogo (catálogo general del
// negocio) e /imprimir/inventario (stock propio de quien lo genera), así
// las dos vistas SIEMPRE se ven iguales entre sí en vez de tener cada
// una su propia copia del diseño.
export interface PrintableCatalogItem {
  id: string;
  productName: string;
  // null cuando el producto tiene un solo color (no hace falta
  // aclararlo) o cuando no aplica.
  colorName: string | null;
  imageUrl: string | null;
  price: number;
  // Solo se pasa en la vista de inventario propio — el catálogo
  // compartido nunca muestra cantidades (no es información para
  // compartir con clientas).
  quantity?: number;
}

export function PrintableCatalog({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: PrintableCatalogItem[];
  emptyMessage: string;
}) {
  return (
    <>
      <header className="mb-8 border-b-2 border-primary/30 pb-4 text-center print:mb-6">
        <h1 className="font-display text-3xl text-primary">{title}</h1>
        <p className="mt-1 text-sm text-ink/60">{subtitle}</p>
      </header>

      {items.length === 0 ? (
        <p className="text-center text-sm text-ink/50">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center break-inside-avoid rounded-xl border border-gold/25 p-3 text-center"
            >
              <div className="mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="h-6 w-6 text-ink/20" aria-hidden />
                )}
              </div>
              <p className="line-clamp-2 text-sm font-medium text-ink">{item.productName}</p>
              {item.colorName && <p className="text-xs text-ink/50">{item.colorName}</p>}
              <p className="mt-1 font-mono text-sm font-semibold text-primary">{formatCurrency(item.price)}</p>
              {item.quantity !== undefined && (
                <p className="mt-0.5 text-[11px] text-ink/50">
                  {item.quantity} disponible{item.quantity === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
