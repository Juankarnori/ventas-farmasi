import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

export interface SaleHistoryRow {
  id: string;
  saleDate: string;
  customerName: string | null;
  sellerName: string;
  productName: string;
  quantity: number;
  salePrice: number;
  profit: number;
}

export function SaleHistoryTable({ rows }: { rows: SaleHistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink/50">No hay ventas para este filtro.</p>;
  }

  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0);

  return (
    <>
      <Table>
        <Thead>
          <Tr>
            <Th className="pl-5">Fecha</Th>
            <Th>Producto</Th>
            <Th>Cliente</Th>
            <Th>Usuaria</Th>
            <Th className="text-right">Cant.</Th>
            <Th className="text-right">Precio</Th>
            <Th className="pr-5 text-right">Ganancia</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="pl-5">{formatDate(r.saleDate)}</Td>
              <Td>{r.productName}</Td>
              <Td className="text-ink/60">{r.customerName ?? "—"}</Td>
              <Td>{r.sellerName}</Td>
              <Td numeric>{r.quantity}</Td>
              <Td numeric>{formatCurrency(r.salePrice)}</Td>
              <Td numeric className="pr-5 text-sage">
                {formatCurrency(r.profit)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <p className="border-t border-ink/10 px-5 py-3 text-right text-sm text-ink/60">
        Ganancia total:{" "}
        <span className="font-mono text-base tabular-nums text-sage">
          {formatCurrency(totalProfit)}
        </span>
      </p>
    </>
  );
}
