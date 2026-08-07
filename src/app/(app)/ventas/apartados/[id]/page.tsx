import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { variantLabel } from "@/lib/utils/variant-label";
import { RegisterPaymentDialog } from "@/components/ventas/register-payment-dialog";
import { CancelApartadoButton } from "@/components/ventas/cancel-apartado-button";
import { PaymentMethodEditor } from "@/components/ventas/payment-method-editor";
import { markItemDelivered, updateSalePaymentMethod } from "../../actions";

export default async function ApartadoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: sale }, { data: balance }, { data: items }, { data: payments }, { data: profiles }] =
    await Promise.all([
      supabase.from("sales").select("*").eq("id", id).maybeSingle(),
      supabase.from("sale_balances").select("*").eq("sale_id", id).maybeSingle(),
      supabase.from("sale_items").select("*").eq("sale_id", id),
      supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", id)
        .order("payment_date", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
    ]);

  if (!sale) {
    notFound();
  }

  const variantIds = (items ?? []).map((i) => i.variant_id);
  const [{ data: variants }, { data: products }] = await Promise.all([
    variantIds.length > 0
      ? supabase.from("product_variants").select("id, product_id, color_name").in("id", variantIds)
      : Promise.resolve({ data: [] }),
    supabase.from("products").select("id, name"),
  ]);

  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const total = sale.total_price;
  const paid = balance?.amount_paid ?? 0;
  const pendingBalance = balance?.balance ?? total;
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const canRegisterPayment = sale.payment_status === "con_abonos";
  const anyDelivered = (items ?? []).some((i) => i.delivered);
  const canCancel = sale.payment_status === "con_abonos" && !anyDelivered;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/ventas/apartados"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a apartados
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">{sale.customer_name}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {formatDate(sale.sale_date)} · {profileById.get(sale.seller_profile_id)?.display_name ?? "—"}
            {sale.customer_phone && ` · ${sale.customer_phone}`}
          </p>
          <div className="mt-1.5">
            <PaymentMethodEditor
              paymentMethod={sale.payment_method}
              bankNote={sale.bank_note}
              action={updateSalePaymentMethod.bind(null, sale.id)}
            />
          </div>
        </div>
        <Badge
          variant={
            sale.payment_status === "cancelado"
              ? "neutral"
              : sale.payment_status === "con_abonos"
                ? "gold"
                : "sage"
          }
        >
          {sale.payment_status === "con_abonos" && "Con saldo pendiente"}
          {sale.payment_status === "completado" && "Completado"}
          {sale.payment_status === "cancelado" && "Cancelado"}
        </Badge>
      </div>

      <Card className="mt-6">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-ink/50">Total</p>
            <p className="font-mono text-lg tabular-nums text-ink">{formatCurrency(total)}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50">Abonado</p>
            <p className="font-mono text-lg tabular-nums text-ink">{formatCurrency(paid)}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50">Saldo</p>
            <p className="font-mono text-lg tabular-nums font-semibold text-ink">
              {formatCurrency(pendingBalance)}
            </p>
          </div>
        </div>
        {sale.payment_status !== "cancelado" && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        )}
        {(canRegisterPayment || canCancel) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canRegisterPayment && <RegisterPaymentDialog saleId={sale.id} />}
            {canCancel && <CancelApartadoButton saleId={sale.id} />}
          </div>
        )}
        {sale.payment_status === "con_abonos" && anyDelivered && (
          <p className="mt-2 text-xs text-ink/50">
            Ya entregaste productos de este apartado, así que no se puede cancelar.
          </p>
        )}
      </Card>

      <Card className="mt-6 p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Productos apartados</CardTitle>
        </CardHeader>
        <Table>
          <Thead>
            <Tr>
              <Th>Producto</Th>
              <Th className="text-right">Cant.</Th>
              <Th className="text-right">Precio</Th>
              <Th>Entrega</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(items ?? []).map((item) => {
              const productName = productById.get(item.product_id)?.name ?? "—";
              const colorName = variantById.get(item.variant_id)?.color_name;
              return (
                <Tr key={item.id}>
                  <Td>{colorName ? variantLabel(productName, colorName) : productName}</Td>
                  <Td numeric>{item.quantity}</Td>
                  <Td numeric>{formatCurrency(item.sale_price)}</Td>
                  <Td>
                    {item.delivered ? (
                      <span className="flex items-center gap-1 text-xs text-sage">
                        <Check className="h-3.5 w-3.5" /> Entregado
                      </span>
                    ) : (
                      <form action={markItemDelivered.bind(null, sale.id, item.id)}>
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1.5 text-xs text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                        >
                          Marcar entregado
                        </button>
                      </form>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Card>

      <Card className="mt-6 p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Historial de abonos</CardTitle>
        </CardHeader>
        {payments && payments.length > 0 ? (
          <Table>
            <Thead>
              <Tr>
                <Th>Fecha</Th>
                <Th className="text-right">Monto</Th>
                <Th>Método</Th>
                <Th>Quién lo recibió</Th>
              </Tr>
            </Thead>
            <Tbody>
              {payments.map((p) => (
                <Tr key={p.id}>
                  <Td>{formatDate(p.payment_date)}</Td>
                  <Td numeric>{formatCurrency(p.amount)}</Td>
                  <Td className="text-ink/60">{p.method ?? "—"}</Td>
                  <Td className="text-ink/60">{profileById.get(p.profile_id)?.display_name ?? "—"}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink/50">Todavía no hay abonos registrados.</p>
        )}
      </Card>
    </div>
  );
}
