import { createClient } from "@/lib/supabase/server";
import { KpiGrid } from "@/components/finanzas/kpi-grid";
import { DateRangeFilter } from "@/components/finanzas/date-range-filter";
import { SalesProfitChart, type DailyPoint } from "@/components/finanzas/sales-profit-chart";
import { TopProductsTable, type TopProductRow } from "@/components/finanzas/top-products-table";
import { ExpensesForm } from "@/components/finanzas/expenses-form";
import { ExpensesTable } from "@/components/finanzas/expenses-table";
import { AlertsPanel } from "@/components/finanzas/alerts-panel";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { computeNetDebts, type DebtEntry } from "@/lib/utils/loan-debt";
import { getSessionProfile } from "@/lib/auth/get-session-profile";

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; usuaria?: string }>;
}) {
  const { desde, hasta, usuaria } = await searchParams;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  // Igual que en Ventas: una no-admin nunca ve el negocio completo acá,
  // solo sus propias ventas/pedidos/gastos — el selector de usuaria ni
  // siquiera le aparece (ver DateRangeFilter), y esto cierra el intento de
  // forzar el query param a mano. La administradora sigue viendo todo (o
  // filtrando a una persona puntual) como hasta ahora.
  const effectiveUsuaria = profile.is_admin ? usuaria : profile.id;

  const [{ data: profiles }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("products").select("id, name, stock, low_stock_threshold"),
  ]);

  let salesQuery = supabase.from("sales").select("*").in("payment_status", ["pagado", "completado"]);
  if (desde) salesQuery = salesQuery.gte("sale_date", desde);
  if (hasta) salesQuery = salesQuery.lte("sale_date", hasta);
  if (effectiveUsuaria) salesQuery = salesQuery.eq("seller_profile_id", effectiveUsuaria);
  const { data: sales } = await salesQuery;
  const saleIds = (sales ?? []).map((s) => s.id);

  let expensesQuery = supabase.from("expenses").select("*");
  if (desde) expensesQuery = expensesQuery.gte("expense_date", desde);
  if (hasta) expensesQuery = expensesQuery.lte("expense_date", hasta);
  if (effectiveUsuaria) expensesQuery = expensesQuery.eq("created_by", effectiveUsuaria);
  const { data: expenses } = await expensesQuery.order("expense_date", { ascending: false });

  const saleById = new Map((sales ?? []).map((s) => [s.id, s]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const items = saleIds.length > 0 ? (await supabase.from("sale_items").select("*").in("sale_id", saleIds)).data : [];

  let totalSales = 0;
  let totalCost = 0;
  const byDate = new Map<string, { ventas: number; ganancia: number }>();
  const byProduct = new Map<string, { quantity: number; profit: number }>();

  for (const item of items ?? []) {
    const sale = saleById.get(item.sale_id);
    if (!sale) continue;

    const lineTotal = item.sale_price * item.quantity;
    const lineCost = item.cost_price * item.quantity;
    totalSales += lineTotal;
    totalCost += lineCost;

    const dayEntry = byDate.get(sale.sale_date) ?? { ventas: 0, ganancia: 0 };
    dayEntry.ventas += lineTotal;
    dayEntry.ganancia += item.profit;
    byDate.set(sale.sale_date, dayEntry);

    const productEntry = byProduct.get(item.product_id) ?? { quantity: 0, profit: 0 };
    productEntry.quantity += item.quantity;
    productEntry.profit += item.profit;
    byProduct.set(item.product_id, productEntry);
  }

  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalSales - totalCost - totalExpenses;

  const chartData: DailyPoint[] = Array.from(byDate.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const topProducts: TopProductRow[] = Array.from(byProduct.entries())
    .map(([productId, v]) => ({
      productId,
      productName: productById.get(productId)?.name ?? "—",
      quantity: v.quantity,
      profit: v.profit,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const lowStockProducts = (products ?? []).filter((p) => p.stock <= p.low_stock_threshold);

  const { count: pendingLoansCount } = await supabase
    .from("loans")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendiente");

  const { data: unsettledLoans } = await supabase
    .from("loans")
    .select("from_profile_id, to_profile_id, quantity, unit_cost")
    .eq("status", "vendido")
    .is("debt_settled_at", null);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const debts: DebtEntry[] = (unsettledLoans ?? []).map((l) => ({
    fromProfileId: l.from_profile_id,
    fromName: profileById.get(l.from_profile_id)?.display_name ?? "—",
    toProfileId: l.to_profile_id,
    toName: profileById.get(l.to_profile_id)?.display_name ?? "—",
    amount: l.unit_cost * l.quantity,
  }));

  const debtMessages = computeNetDebts(debts).map((line) => ({
    debtorName: line.debtorName,
    creditorName: line.creditorName,
    amount: line.amount,
  }));

  const { data: openApartados } = await supabase
    .from("sales")
    .select("id")
    .eq("payment_status", "con_abonos");

  const openApartadoIds = (openApartados ?? []).map((s) => s.id);
  const { data: openBalances } =
    openApartadoIds.length > 0
      ? await supabase.from("sale_balances").select("balance").in("sale_id", openApartadoIds)
      : { data: [] };

  const accountsReceivable = (openBalances ?? []).reduce((sum, b) => sum + b.balance, 0);

  const { count: undeliveredCount } = await supabase
    .from("sale_items")
    .select("id", { count: "exact", head: true })
    .eq("delivered", false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Finanzas</h1>
          <p className="mt-1 text-sm text-ink/60">Resumen del negocio.</p>
        </div>
        <DateRangeFilter profiles={profiles ?? []} isAdmin={profile.is_admin} />
      </div>

      <AlertsPanel
        lowStockProducts={lowStockProducts}
        pendingLoansCount={pendingLoansCount ?? 0}
        debtMessages={debtMessages}
        accountsReceivable={accountsReceivable}
        undeliveredCount={undeliveredCount ?? 0}
      />

      <KpiGrid
        totalSales={totalSales}
        totalCost={totalCost}
        totalExpenses={totalExpenses}
        netProfit={netProfit}
      />

      <Card>
        <CardHeader>
          <CardTitle>Ventas y ganancia en el tiempo</CardTitle>
        </CardHeader>
        <SalesProfitChart data={chartData} />
      </Card>

      <Card className="p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Productos más vendidos</CardTitle>
        </CardHeader>
        <TopProductsTable rows={topProducts} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4">
          <ExpensesForm />
          <ExpensesTable expenses={expenses ?? []} />
        </div>
      </Card>
    </div>
  );
}
