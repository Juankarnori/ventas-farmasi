import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";

export interface TopProductRow {
  productId: string;
  productName: string;
  quantity: number;
  profit: number;
}

export function TopProductsTable({ rows }: { rows: TopProductRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink/50">Todavía no hay ventas.</p>;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Producto</Th>
          <Th className="text-right">Unidades vendidas</Th>
          <Th className="text-right">Ganancia</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((r) => (
          <Tr key={r.productId}>
            <Td>{r.productName}</Td>
            <Td numeric>{r.quantity}</Td>
            <Td numeric className="font-semibold text-ink">
              {formatCurrency(r.profit)}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
