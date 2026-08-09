import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { variantLabel } from "@/lib/utils/variant-label";
import { CustomerContactEditor } from "@/components/clientes/customer-contact-editor";
import {
  CustomerApartadoRow,
  type CustomerApartadoData,
  type CustomerApartadoItem,
} from "@/components/clientes/customer-apartado-row";
import { DeleteCustomerButton } from "@/components/clientes/delete-customer-button";
import { SaleHistoryTable, type SaleHistoryRow } from "@/components/shared/sale-history-table";

export default async function ClienteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();

  if (!customer) {
    notFound();
  }

  // Clientes es un registro compartido de seguimiento: si Mamá y Yo le
  // vendemos ambas a esta clienta, las dos necesitamos ver su historial
  // completo. Por eso esto no consulta `sales`/`sale_items` directo (RLS
  // los filtraría a "lo que yo le vendí"), sino una función que trae el
  // historial completo de la clienta a propósito, sin importar quién de
  // las dos hizo cada venta. Ver 0022_privacy_orders_sales.sql.
  const [{ data: history }, { data: apartados }, { data: apartadoItems }] = await Promise.all([
    supabase.rpc("get_customer_purchase_history", { p_customer_id: id }),
    // Mismo motivo que el historial: no se puede consultar `sales`
    // directo (RLS lo filtraría a "solo lo que yo le vendí"), así que
    // esto también pasa por una función que trae los apartados de esta
    // clienta completos, sin importar quién de las dos los vendió.
    supabase.rpc("get_customer_apartados", { p_customer_id: id }),
    // Detalle de entrega por producto de esos apartados — mismo motivo
    // que arriba, sale_items es privado por RLS desde 0022.
    supabase.rpc("get_customer_apartado_items", { p_customer_id: id }),
  ]);

  const variantIds = [...new Set((history ?? []).map((h) => h.variant_id))];
  const [{ data: variants }, { data: products }, { data: profiles }] = await Promise.all([
    variantIds.length > 0
      ? supabase.from("product_variants").select("id, product_id, color_name").in("id", variantIds)
      : Promise.resolve({ data: [] }),
    supabase.from("products").select("id, name"),
    supabase.from("profiles").select("id, display_name"),
  ]);

  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  function labelFor(item: { product_id: string; variant_id: string }) {
    const productName = productById.get(item.product_id)?.name ?? "—";
    const colorName = variantById.get(item.variant_id)?.color_name;
    return colorName ? variantLabel(productName, colorName) : productName;
  }

  const historyRows: SaleHistoryRow[] = (history ?? [])
    .map(
      (item): SaleHistoryRow => ({
        id: item.sale_item_id,
        saleDate: item.sale_date,
        customerName: customer.name,
        sellerName: profileById.get(item.seller_profile_id)?.display_name ?? "—",
        productName: labelFor(item),
        quantity: item.quantity,
        salePrice: item.sale_price,
        profit: item.profit,
        paymentStatus: item.payment_status,
      }),
    )
    .sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));

  const itemsBySale = new Map<string, CustomerApartadoItem[]>();
  for (const item of apartadoItems ?? []) {
    const list = itemsBySale.get(item.sale_id) ?? [];
    list.push({
      id: `${item.sale_id}:${item.variant_id}`,
      label: labelFor(item),
      quantity: item.quantity,
      delivered: item.delivered,
    });
    itemsBySale.set(item.sale_id, list);
  }

  const apartadoRows: CustomerApartadoData[] = (apartados ?? []).map((a) => ({
    id: a.sale_id,
    saleDate: a.sale_date,
    total: a.total_price,
    paid: a.amount_paid,
    balance: a.balance,
    status: a.payment_status,
    items: itemsBySale.get(a.sale_id) ?? [],
  }));

  // Suma de TODOS los apartados con saldo pendiente, no de uno solo —
  // mismo número que el badge del listado general (list_customer_pending_balances),
  // acá calculado sobre los mismos apartados que ya se traen para la
  // sección de abajo, en vez de una tercera consulta aparte.
  const pendingBalance = apartadoRows
    .filter((a) => a.status === "con_abonos")
    .reduce((sum, a) => sum + a.balance, 0);

  // Productos más comprados: se cuentan todas las compras que no hayan
  // sido canceladas (los apartados en curso también cuentan — ya eligió
  // el producto, aunque todavía no haya terminado de pagarlo).
  const topByVariant = new Map<string, { label: string; quantity: number }>();
  for (const item of history ?? []) {
    if (item.payment_status === "cancelado") continue;
    const entry = topByVariant.get(item.variant_id) ?? { label: labelFor(item), quantity: 0 };
    entry.quantity += item.quantity;
    topByVariant.set(item.variant_id, entry);
  }
  const topProducts = Array.from(topByVariant.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Total gastado / cantidad de compras: solo ventas realmente cobradas
  // (mismo criterio que el resto de la app para "ganancia"/"ventas" —
  // un apartado con saldo pendiente todavía no es plata en mano).
  const paidItems = (history ?? []).filter(
    (item) => item.payment_status === "pagado" || item.payment_status === "completado",
  );
  const paidSaleIds = new Set(paidItems.map((item) => item.sale_id));
  const totalSpent = paidItems.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a clientes
        </Link>
        <DeleteCustomerButton customerId={customer.id} customerName={customer.name} />
      </div>

      {customer.archived_at && (
        <p className="mb-3 rounded-lg bg-panel/40 px-3 py-2 text-xs text-ink/60">
          Esta clienta está archivada — no aparece en el listado general.
        </p>
      )}

      <CustomerContactEditor
        customerId={customer.id}
        name={customer.name}
        phone={customer.phone}
        birthDate={customer.birth_date}
        notes={customer.notes}
        defaultEditing={edit === "1"}
      />

      {/* No se metió adentro de CustomerContactEditor a propósito: ese
          componente ya tiene su propio layout flex interno (nombre+lápiz
          en modo vista, formulario flex-wrap en modo edición) — meterle
          un badge ahí adentro como children pelearía con ese layout.
          Queda como su propia línea, debajo. */}
      {pendingBalance > 0 && (
        <Badge variant="gold" className="mt-2 w-fit">
          Saldo pendiente: {formatCurrency(pendingBalance)}
        </Badge>
      )}

      <Card className="mt-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink/50">Total gastado</p>
            <p className="font-mono text-lg tabular-nums font-semibold text-ink">
              {formatCurrency(totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink/50">Compras</p>
            <p className="font-mono text-lg tabular-nums text-ink">{paidSaleIds.size}</p>
          </div>
        </div>
      </Card>

      {apartadoRows.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Apartados</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-2">
            {apartadoRows.map((a) => (
              <CustomerApartadoRow key={a.id} apartado={a} />
            ))}
          </div>
        </Card>
      )}

      {topProducts.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Lo que más compra</CardTitle>
          </CardHeader>
          <ul className="flex flex-col gap-1.5 text-sm text-ink">
            {topProducts.map((p) => (
              <li key={p.label}>
                {p.quantity}x {p.label}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4 p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Historial de compras</CardTitle>
        </CardHeader>
        <SaleHistoryTable rows={historyRows} />
      </Card>
    </div>
  );
}
