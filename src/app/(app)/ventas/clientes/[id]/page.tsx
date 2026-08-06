import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { variantLabel } from "@/lib/utils/variant-label";
import { CustomerContactEditor } from "@/components/ventas/customer-contact-editor";
import { SaleHistoryTable, type SaleHistoryRow } from "@/components/ventas/sale-history-table";
import { updateCustomerNotes } from "../actions";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();

  if (!customer) {
    notFound();
  }

  const { data: sales } = await supabase
    .from("sales")
    .select("*")
    .eq("customer_id", id)
    .order("sale_date", { ascending: false });

  const saleIds = (sales ?? []).map((s) => s.id);
  const { data: items } =
    saleIds.length > 0
      ? await supabase.from("sale_items").select("*").in("sale_id", saleIds)
      : { data: [] };

  const variantIds = [...new Set((items ?? []).map((i) => i.variant_id))];
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
  const saleById = new Map((sales ?? []).map((s) => [s.id, s]));

  function labelFor(item: { product_id: string; variant_id: string }) {
    const productName = productById.get(item.product_id)?.name ?? "—";
    const colorName = variantById.get(item.variant_id)?.color_name;
    return colorName ? variantLabel(productName, colorName) : productName;
  }

  const historyRows: SaleHistoryRow[] = (items ?? [])
    .map((item): SaleHistoryRow | null => {
      const sale = saleById.get(item.sale_id);
      if (!sale) return null;
      return {
        id: item.id,
        saleDate: sale.sale_date,
        customerName: customer.name,
        sellerName: profileById.get(sale.seller_profile_id)?.display_name ?? "—",
        productName: labelFor(item),
        quantity: item.quantity,
        salePrice: item.sale_price,
        profit: item.profit,
      };
    })
    .filter((r): r is SaleHistoryRow => r !== null)
    .sort((a, b) => (a.saleDate < b.saleDate ? 1 : -1));

  // Productos más comprados: se cuentan todas las compras que no hayan
  // sido canceladas (los apartados en curso también cuentan — ya eligió
  // el producto, aunque todavía no haya terminado de pagarlo).
  const topByVariant = new Map<string, { label: string; quantity: number }>();
  for (const item of items ?? []) {
    const sale = saleById.get(item.sale_id);
    if (!sale || sale.payment_status === "cancelado") continue;
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
  const paidSales = (sales ?? []).filter(
    (s) => s.payment_status === "pagado" || s.payment_status === "completado",
  );
  const paidSaleIds = new Set(paidSales.map((s) => s.id));
  const totalSpent = (items ?? [])
    .filter((i) => paidSaleIds.has(i.sale_id))
    .reduce((sum, i) => sum + i.sale_price * i.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/ventas/clientes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>

      <CustomerContactEditor customerId={customer.id} name={customer.name} phone={customer.phone} />

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
            <p className="font-mono text-lg tabular-nums text-ink">{paidSales.length}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Notas y preferencias</CardTitle>
        </CardHeader>
        <form action={updateCustomerNotes.bind(null, customer.id)} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="notes" className="sr-only">
              Notas
            </Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={customer.notes ?? ""}
              placeholder="Ej: prefiere tonos coral, alérgica a fragancias fuertes, siempre pregunta por novedades de skincare..."
            />
          </div>
          <Button type="submit" size="sm" className="w-fit">
            Guardar notas
          </Button>
        </form>
      </Card>

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
