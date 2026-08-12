import Link from "next/link";
import { PackagePlus } from "lucide-react";

// Cuando ni la vendedora ni nadie más en el negocio tiene stock de esta
// variante (ver overStock + totalStock === 0 en SaleLineItems), "Pedir
// prestado" no tiene nada para ofrecer — este link manda directo a Pedidos
// → nuevo pedido con el producto, color y cantidad faltante ya
// precargados (ver pedidos/nuevo/page.tsx), para no tener que rebuscarlo.
export function CreateOrderLink({
  productId,
  variantId,
  quantity,
}: {
  productId: string;
  variantId: string;
  quantity: number;
}) {
  const params = new URLSearchParams({
    product_id: productId,
    variant_id: variantId,
    quantity: String(Math.max(1, quantity)),
  });

  return (
    <Link
      href={`/pedidos/nuevo?${params.toString()}`}
      className="mt-1.5 flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
    >
      <PackagePlus className="h-3.5 w-3.5" /> Crear pedido
    </Link>
  );
}
