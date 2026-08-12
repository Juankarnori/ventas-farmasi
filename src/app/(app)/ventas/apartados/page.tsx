import Link from "next/link";
import { Plus, HandHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VentasTabs } from "@/components/ventas/ventas-tabs";
import { ApartadoCard, type ApartadoCardData } from "@/components/ventas/apartado-card";
import { variantLabel } from "@/lib/utils/variant-label";

export default async function ApartadosPage() {
  const supabase = await createClient();

  const [{ data: sales }, { data: profiles }] = await Promise.all([
    supabase
      .from("sales")
      .select("*")
      .in("payment_status", ["con_abonos", "completado", "cancelado"])
      .order("sale_date", { ascending: false }),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const saleIds = (sales ?? []).map((s) => s.id);

  const [{ data: balances }, { data: items }, { data: products }, { data: variants }] = await Promise.all([
    saleIds.length > 0
      ? supabase.from("sale_balances").select("*").in("sale_id", saleIds)
      : Promise.resolve({ data: [] }),
    saleIds.length > 0
      ? supabase
          .from("sale_items")
          .select("sale_id, delivered, product_id, variant_id, pending_purchase_quantity")
          .in("sale_id", saleIds)
      : Promise.resolve({ data: [] }),
    supabase.from("products").select("id, name"),
    supabase.from("product_variants").select("id, product_id, color_name"),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const balanceBySale = new Map((balances ?? []).map((b) => [b.sale_id, b]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

  function labelFor(item: { product_id: string; variant_id: string }) {
    const productName = productById.get(item.product_id)?.name ?? "—";
    const colorName = variantById.get(item.variant_id)?.color_name;
    return colorName ? variantLabel(productName, colorName) : productName;
  }

  const deliveredBySale = new Map<string, boolean>();
  // Igual que en Ventas: agrupa por variante por si el mismo color quedó
  // en más de un renglón — el aviso "⏳ Pendiente de comprar" en la
  // tarjeta muestra un total por producto, no un renglón por renglón que
  // podría duplicar el mismo nombre.
  const pendingBySale = new Map<string, Map<string, { label: string; quantity: number }>>();
  for (const item of items ?? []) {
    const current = deliveredBySale.get(item.sale_id) ?? true;
    deliveredBySale.set(item.sale_id, current && item.delivered);

    if (item.pending_purchase_quantity > 0) {
      const saleMap = pendingBySale.get(item.sale_id) ?? new Map();
      const entry = saleMap.get(item.variant_id) ?? { label: labelFor(item), quantity: 0 };
      entry.quantity += item.pending_purchase_quantity;
      saleMap.set(item.variant_id, entry);
      pendingBySale.set(item.sale_id, saleMap);
    }
  }

  const apartados: ApartadoCardData[] = (sales ?? [])
    // Un apartado completado (saldo $0) Y con todo entregado ya terminó su
    // ciclo de vida acá — de ahí en más se ve como cualquier otra venta
    // resuelta, solo en el historial de Ventas (que ya incluye
    // payment_status = 'completado'). Se queda en Apartados mientras le
    // falte plata, entrega, o esté cancelado.
    .filter((s) => !(s.payment_status === "completado" && (deliveredBySale.get(s.id) ?? true)))
    .map((s) => {
      const balance = balanceBySale.get(s.id);
      return {
        id: s.id,
        customerName: s.customer_name ?? "Sin nombre",
        sellerName: profileById.get(s.seller_profile_id)?.display_name ?? "—",
        saleDate: s.sale_date,
        total: s.total_price,
        paid: balance?.amount_paid ?? 0,
        balance: balance?.balance ?? s.total_price,
        status: s.payment_status,
        allDelivered: deliveredBySale.get(s.id) ?? true,
        paymentMethod: s.payment_method,
        bankNote: s.bank_note,
        pendingItems: Array.from((pendingBySale.get(s.id) ?? new Map()).values()),
      };
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Apartados</h1>
          <p className="mt-1 text-sm text-ink/60">Clientas que pagan de a poco.</p>
        </div>
        <Link href="/ventas/nueva">
          <Button>
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <VentasTabs active="apartados" />
      </div>

      <div className="mt-6">
        {apartados.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apartados.map((a) => (
              <ApartadoCard key={a.id} apartado={a} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={HandHeart}
            title="Todavía no hay apartados"
            description="Cuando una clienta pague de a poco, creá la venta como apartado desde acá."
            action={
              <Link href="/ventas/nueva">
                <Button size="sm">Nueva venta</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
