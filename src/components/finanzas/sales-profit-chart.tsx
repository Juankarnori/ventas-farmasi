"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

export interface DailyPoint {
  date: string;
  ventas: number;
  ganancia: number;
}

export function SalesProfitChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink/50">
        No hay ventas en este período.
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#3F333814" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatDate(d, "d/M")}
            tick={{ fontSize: 11, fill: "#3F3338" }}
            axisLine={{ stroke: "#3F333822" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#3F3338" }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "ventas" ? "Ventas" : "Ganancia",
            ]}
            labelFormatter={(d) => formatDate(String(d))}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #C8A6C333",
              fontSize: 12,
            }}
          />
          {/* Barra y línea necesitan colores distintos entre sí para
              distinguirse — --accent quedó igual a --primary en esta
              paleta (no vino un 8vo color separado en la tabla), así que
              acá la línea usa --sage (malva) en vez de --accent. */}
          <Bar dataKey="ventas" fill="#733865" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line type="monotone" dataKey="ganancia" stroke="#A86FA3" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
