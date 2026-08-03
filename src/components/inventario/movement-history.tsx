import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDate } from "@/lib/utils/date";
import { variantLabel } from "@/lib/utils/variant-label";
import type { StockMovementType } from "@/lib/types/database.types";

const TYPE_LABELS: Record<StockMovementType, string> = {
  entrada_pedido: "Entrada (pedido)",
  salida_venta: "Salida (venta)",
  ajuste_manual: "Ajuste manual",
  prestamo: "Préstamo",
};

const TYPE_SIGN: Record<StockMovementType, "+" | "-" | "·"> = {
  entrada_pedido: "+",
  salida_venta: "-",
  ajuste_manual: "·",
  prestamo: "·",
};

export interface MovementRow {
  id: string;
  type: StockMovementType;
  quantity: number;
  note: string | null;
  created_at: string;
  product: { name: string } | null;
  variant: { color_name: string } | null;
}

export function MovementHistory({ movements }: { movements: MovementRow[] }) {
  if (movements.length === 0) {
    return <p className="py-6 text-center text-sm text-ink/50">Todavía no hay movimientos.</p>;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Fecha</Th>
          <Th>Producto</Th>
          <Th>Tipo</Th>
          <Th className="text-right">Cantidad</Th>
          <Th>Nota</Th>
        </Tr>
      </Thead>
      <Tbody>
        {movements.map((m) => (
          <Tr key={m.id}>
            <Td>{formatDate(m.created_at)}</Td>
            <Td>
              {m.product && m.variant ? variantLabel(m.product.name, m.variant.color_name) : "—"}
            </Td>
            <Td>{TYPE_LABELS[m.type]}</Td>
            <Td numeric>
              {TYPE_SIGN[m.type]}
              {m.quantity}
            </Td>
            <Td className="text-ink/60">{m.note ?? "—"}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
