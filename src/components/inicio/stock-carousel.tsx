import Link from "next/link";
import { ImageOff, Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { AvailableStockItem } from "@/lib/queries/available-stock";

// Carrusel simple: scroll horizontal nativo + `snap` — nada de librería
// ni JS de por medio, arrastrás o usás el scroll del mouse/trackpad y las
// tarjetas encastran solas. Es la opción que pidió la consigna como "más
// simple de implementar bien".
export function StockCarousel({ items }: { items: AvailableStockItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="No hay stock disponible ahora mismo"
        description="En cuanto tengas unidades cargadas, van a aparecer acá."
      />
    );
  }

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {items.map((item) => (
        <Link
          key={item.variantId}
          href={`/catalogo/${item.productId}`}
          className="flex w-32 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gold/20 bg-panel/40 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-ink/5">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-6 w-6 text-ink/20" aria-hidden />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-2">
            <p className="line-clamp-2 text-xs font-medium text-ink">{item.label}</p>
            <Badge variant="sage" className="w-fit">
              {item.stock} u.
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}
