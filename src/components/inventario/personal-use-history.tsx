import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";

export interface PersonalUseRow {
  id: string;
  usedAt: string;
  label: string;
  quantity: number;
  value: number;
  note: string | null;
  profileName: string;
}

export function PersonalUseHistory({ rows }: { rows: PersonalUseRow[] }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink/50">Todavía no hay usos personales registrados.</p>;
  }

  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <>
      <Table>
        <Thead>
          <Tr>
            <Th className="pl-5">Fecha</Th>
            <Th>Producto</Th>
            <Th>Usuaria</Th>
            <Th className="text-right">Cantidad</Th>
            <Th className="text-right">Valor</Th>
            <Th className="pr-5">Nota</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="pl-5">{formatDate(r.usedAt)}</Td>
              <Td>{r.label}</Td>
              <Td className="text-ink/60">{r.profileName}</Td>
              <Td numeric>{r.quantity}</Td>
              <Td numeric>{formatCurrency(r.value)}</Td>
              <Td className="pr-5 text-ink/60">{r.note ?? "—"}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <p className="border-t border-ink/10 px-5 py-3 text-right text-sm text-ink/60">
        Valor total al costo:{" "}
        <span className="font-mono text-base tabular-nums text-ink">{formatCurrency(totalValue)}</span>
      </p>
    </>
  );
}
