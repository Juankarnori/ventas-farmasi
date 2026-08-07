"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ImageOff, Boxes, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { AvailableStockItem } from "@/lib/queries/available-stock";

// Tiene que coincidir con el ancho real de la tarjeta (w-32 = 8rem =
// 128px) y el gap entre tarjetas (gap-3 = 0.75rem = 12px) para calcular
// cuántas entran por página sin adivinar.
const CARD_WIDTH_PX = 128;
const GAP_PX = 12;
const AUTOPLAY_MS = 6000;

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length === 0) return [items];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

// Slideshow controlado por flechas (sin arrastrar/scroll horizontal):
// mide el ancho real disponible con ResizeObserver para saber cuántas
// tarjetas entran por página, y avanza de a una página completa. El
// auto-avance es un agregado menor sobre esa misma base — se pausa al
// pasar el mouse por encima, y no corre si hay una sola página.
export function StockCarousel({ items }: { items: AvailableStockItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function recalc(width: number) {
      const count = Math.max(1, Math.floor((width + GAP_PX) / (CARD_WIDTH_PX + GAP_PX)));
      setItemsPerPage(count);
    }

    recalc(el.offsetWidth);

    const observer = new ResizeObserver((entries) => {
      recalc(entries[0]?.contentRect.width ?? el.offsetWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pages = chunk(items, itemsPerPage);

  // Si cambia el ancho disponible (o el criterio "mi stock"/"todo el
  // negocio" trae menos páginas), no dejar la página actual apuntando a
  // un índice que ya no existe. Ajustado durante el render (patrón
  // recomendado de React para "derivar estado de un valor que cambió"),
  // no en un efecto — evita el cascading render que dispara `setState`
  // síncrono dentro de un `useEffect`.
  const [prevPagesLength, setPrevPagesLength] = useState(pages.length);
  if (pages.length !== prevPagesLength) {
    setPrevPagesLength(pages.length);
    if (page > pages.length - 1) {
      setPage(Math.max(0, pages.length - 1));
    }
  }

  useEffect(() => {
    if (paused || pages.length <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % pages.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, pages.length]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="No hay stock disponible ahora mismo"
        description="En cuanto tengas unidades cargadas, van a aparecer acá."
      />
    );
  }

  const canGoPrev = page > 0;
  const canGoNext = page < pages.length - 1;

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        aria-label="Productos anteriores"
        disabled={!canGoPrev}
        onClick={() => setPage((p) => Math.max(0, p - 1))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/30 text-ink/60 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div ref={trackRef} className="min-w-0 flex-1 overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {pages.map((pageItems, i) => (
            <div key={i} className="flex w-full shrink-0 gap-3">
              {pageItems.map((item) => (
                <Link
                  key={item.variantId}
                  href={`/catalogo/${item.productId}`}
                  className="flex w-32 shrink-0 flex-col overflow-hidden rounded-xl border border-gold/20 bg-panel/40 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
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
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label="Siguientes productos"
        disabled={!canGoNext}
        onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/30 text-ink/60 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
