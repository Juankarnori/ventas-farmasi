import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Manda directo a Pedidos → nuevo pedido con el producto, color y
// cantidad ya precargados (ver pedidos/nuevo/page.tsx) — para no tener
// que rebuscarlo. Dos orígenes hoy: (1) SaleLineItems, cuando ni la
// vendedora ni nadie más en el negocio tiene stock de una variante; (2) la
// lista "Comprar" (/pedidos/comprar), un botón por cada pendiente.
export function CreateOrderLink({
  productId,
  variantId,
  quantity,
  className,
}: {
  productId: string;
  variantId: string;
  quantity: number;
  className?: string;
}) {
  const params = new URLSearchParams({
    product_id: productId,
    variant_id: variantId,
    quantity: String(Math.max(1, quantity)),
  });

  return (
    <Link
      href={`/pedidos/nuevo?${params.toString()}`}
      className={cn(
        "flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10",
        className,
      )}
    >
      <PackagePlus className="h-3.5 w-3.5" /> Crear pedido
    </Link>
  );
}
