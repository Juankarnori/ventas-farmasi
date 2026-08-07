import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { Badge } from "@/components/ui/badge";

export interface ProductCardData {
  id: string;
  name: string;
  image_url: string | null;
  sale_price: number;
  stock: number;
  low_stock_threshold: number;
  category: { name: string; color: string } | null;
  line: { name: string } | null;
  variants: { id: string; color_name: string; color_hex: string | null }[];
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const lowStock = product.stock <= product.low_stock_threshold;

  return (
    <Link
      href={`/catalogo/${product.id}`}
      className="group flex overflow-hidden rounded-2xl border border-gold/20 bg-panel/40 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <span
        className="w-1.5 shrink-0"
        style={{ backgroundColor: product.category?.color ?? "#C8A6C3" }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col">
        <div className="flex aspect-square items-center justify-center overflow-hidden bg-ink/5">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <ImageOff className="h-8 w-8 text-ink/20" aria-hidden />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <p className="line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
          {product.category && (
            <Badge variant="neutral" className="w-fit">
              {product.category.name}
              {product.line && ` · ${product.line.name}`}
            </Badge>
          )}
          {product.variants.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {product.variants.map((v) => (
                <span
                  key={v.id}
                  title={v.color_name}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink/15 text-[9px] font-semibold text-ink"
                  style={v.color_hex ? { backgroundColor: v.color_hex } : undefined}
                >
                  {!v.color_hex && v.color_name.slice(0, 2).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="font-mono text-sm tabular-nums text-ink">
              {formatCurrency(product.sale_price)}
            </span>
            <Badge variant={lowStock ? "accent" : "sage"}>{product.stock} u.</Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}
