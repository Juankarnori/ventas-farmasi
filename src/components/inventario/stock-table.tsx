import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { LowStockBadge } from "./low-stock-badge";
import { AdjustStockDialog } from "./adjust-stock-dialog";

export interface StockRow {
  id: string;
  name: string;
  stock: number;
  low_stock_threshold: number;
  category: { name: string } | null;
}

export function StockTable({ products }: { products: StockRow[] }) {
  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Producto</Th>
          <Th>Categoría</Th>
          <Th className="text-right">Stock</Th>
          <Th className="text-right">Mínimo</Th>
          <Th>Estado</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {products.map((p) => (
          <Tr key={p.id}>
            <Td>{p.name}</Td>
            <Td>{p.category?.name ?? "—"}</Td>
            <Td numeric>{p.stock}</Td>
            <Td numeric>{p.low_stock_threshold}</Td>
            <Td>
              <LowStockBadge stock={p.stock} threshold={p.low_stock_threshold} />
            </Td>
            <Td>
              <AdjustStockDialog productId={p.id} productName={p.name} />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
