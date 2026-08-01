import { TrendingUp, Receipt, Wallet, PiggyBank } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { formatCurrency } from "@/lib/utils/currency";

export function KpiGrid({
  totalSales,
  totalCost,
  totalExpenses,
  netProfit,
}: {
  totalSales: number;
  totalCost: number;
  totalExpenses: number;
  netProfit: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile label="Ventas totales" value={formatCurrency(totalSales)} icon={Receipt} tone="primary" />
      <StatTile label="Costos" value={formatCurrency(totalCost)} icon={Wallet} tone="gold" />
      <StatTile label="Gastos" value={formatCurrency(totalExpenses)} icon={PiggyBank} tone="accent" />
      <StatTile label="Ganancia neta" value={formatCurrency(netProfit)} icon={TrendingUp} tone="sage" />
    </div>
  );
}
