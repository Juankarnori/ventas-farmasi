import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PedidosTabs } from "@/components/pedidos/pedidos-tabs";
import { CreateOrderLink } from "@/components/shared/create-order-link";
import { formatDate } from "@/lib/utils/date";
import { variantLabel } from "@/lib/utils/variant-label";

// Lista central de "qué falta reponer" en todo el negocio: agrega, entre
// TODAS las ventas/apartados con algún renglón sin stock suficiente al
// momento de venderse (ver create_sale/create_apartado en
// 0046_pending_purchase.sql), el total pendiente por variante — sin
// importar quién vendió, porque reponer stock es una decisión del negocio
// entero, no de una usuaria en particular (mismo criterio que Catálogo).
// Se actualiza sola: en cuanto mark_order_received reconcilia un
// pendiente, la próxima carga de esta página ya no lo va a mostrar — no
// hace falta ninguna acción manual acá.
export default async function ComprarPage() {
  const supabase = await createClient();
  const { data: needed } = await supabase.rpc("list_purchase_needed");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Comprar</h1>
          <p className="mt-1 text-sm text-ink/60">
            Lo que se vendió sin stock suficiente y todavía falta reponer.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <PedidosTabs active="comprar" />
      </div>

      <div className="mt-6">
        {needed && needed.length > 0 ? (
          <div className="flex flex-col gap-3">
            {needed.map((item) => (
              <Card key={item.variant_id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{variantLabel(item.product_name, item.color_name)}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    Pendiente desde el {formatDate(item.oldest_pending_since)}
                    {item.sku && ` · ${item.sku}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-lg tabular-nums text-ink">{item.quantity_needed}</p>
                  <CreateOrderLink
                    productId={item.product_id}
                    variantId={item.variant_id}
                    quantity={item.quantity_needed}
                    className="rounded-full bg-primary px-3 py-1.5 text-background hover:bg-primary/90 hover:text-background"
                  />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No hay nada pendiente de comprar"
            description="Todas las ventas se completaron con stock suficiente."
          />
        )}
      </div>

      <p className="mt-6 text-xs text-ink/40">
        Esta lista se resuelve sola: cuando marqués un pedido como recibido, lo que cubra se descuenta
        automáticamente de acá.{" "}
        <Link href="/pedidos" className="underline hover:text-ink/60">
          Ver pedidos
        </Link>
      </p>
    </div>
  );
}
