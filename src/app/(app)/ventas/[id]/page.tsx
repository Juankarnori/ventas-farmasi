import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SaleEditPanel, type SaleDisplayRow } from "@/components/ventas/sale-edit-panel";
import type { SellableProduct, SaleItemDefault } from "@/components/ventas/sale-line-items";
import { variantLabel } from "@/lib/utils/variant-label";
import { formatDate } from "@/lib/utils/date";
import { updateSaleItems } from "../actions";

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: sale }, { data: items }] = await Promise.all([
    supabase.from("sales").select("*").eq("id", id).maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", id),
  ]);

  if (!sale) {
    notFound();
  }

  const [
    { data: allProducts },
    { data: allVariants },
    { data: sellerStock },
    { data: categories },
    { data: lines },
    { data: customer },
    { data: seller },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sale_price, category_id, line_id")
      .order("name", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, product_id, color_name, price_override, sku")
      .order("color_name", { ascending: true }),
    // Stock de la VENDEDORA de esta venta, no de quien está mirando la
    // página — una admin puede estar corrigiendo la venta de otra
    // usuaria, y el "tenés X" del formulario tiene que reflejar el stock
    // de quien realmente la vendió.
    supabase.from("variant_stock").select("variant_id, stock").eq("profile_id", sale.seller_profile_id),
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
    supabase.from("product_lines").select("id, name, category_id").order("name", { ascending: true }),
    sale.customer_id
      ? supabase.from("customers").select("name").eq("id", sale.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("display_name").eq("id", sale.seller_profile_id).maybeSingle(),
  ]);

  const productById = new Map((allProducts ?? []).map((p) => [p.id, p]));
  const variantById = new Map((allVariants ?? []).map((v) => [v.id, v]));

  // Stock "ajustado" para el editor: el stock actual de la vendedora más
  // lo que esta misma venta ya tenía reservado de esa variante — así el
  // formulario no muestra un "no te alcanza" falso sobre una cantidad que
  // en realidad ya es tuya. La diferencia real (a favor o en contra) se
  // descuenta/devuelve recién al guardar (update_sale_items).
  const oldQtyByVariant = new Map<string, number>();
  for (const item of items ?? []) {
    oldQtyByVariant.set(item.variant_id, (oldQtyByVariant.get(item.variant_id) ?? 0) + item.quantity);
  }
  const sellerStockByVariant = new Map((sellerStock ?? []).map((s) => [s.variant_id, s.stock]));

  const variantsByProduct = new Map<string, typeof allVariants>();
  for (const v of allVariants ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list!.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const sellableProducts: SellableProduct[] = (allProducts ?? [])
    .map((p) => ({
      ...p,
      variants: (variantsByProduct.get(p.id) ?? []).map((v) => ({
        id: v.id,
        color_name: v.color_name,
        price_override: v.price_override,
        sku: v.sku,
        stock: (sellerStockByVariant.get(v.id) ?? 0) + (oldQtyByVariant.get(v.id) ?? 0),
      })),
    }))
    .filter((p) => p.variants.length > 0);

  function labelFor(item: { product_id: string; variant_id: string }) {
    const productName = productById.get(item.product_id)?.name ?? "—";
    const colorName = variantById.get(item.variant_id)?.color_name;
    return colorName ? variantLabel(productName, colorName) : productName;
  }

  const displayRows: SaleDisplayRow[] = (items ?? []).map((item) => ({
    id: item.id,
    label: labelFor(item),
    quantity: item.quantity,
    salePrice: item.sale_price,
  }));

  const defaultItems: SaleItemDefault[] = (items ?? []).map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    quantity: item.quantity,
    sale_price: item.sale_price,
  }));

  const isEditable = sale.payment_status === "pagado";
  const updateAction = updateSaleItems.bind(null, sale.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/ventas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a ventas
      </Link>

      <div>
        <h1 className="font-display text-2xl text-ink">
          {customer?.name ?? sale.customer_name ?? "Venta de mostrador"}
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          {formatDate(sale.sale_date)} · {seller?.display_name ?? "—"}
        </p>
      </div>

      {isEditable ? (
        <SaleEditPanel
          displayRows={displayRows}
          totalPrice={sale.total_price}
          paymentMethod={sale.payment_method}
          bankNote={sale.bank_note}
          defaultItems={defaultItems}
          products={sellableProducts}
          categories={categories ?? []}
          lines={lines ?? []}
          action={updateAction}
        />
      ) : (
        <div className="mt-6 rounded-xl border border-gold/20 bg-panel/30 p-4 text-sm text-ink/70">
          Esta venta es un apartado — para editar sus productos, gestionar abonos o cambiar el método
          de pago, andá a su ficha en{" "}
          <Link
            href={`/ventas/apartados/${sale.id}`}
            className="font-medium text-primary hover:underline"
          >
            Apartados
          </Link>
          .
        </div>
      )}
    </div>
  );
}
