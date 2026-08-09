import Link from "next/link";
import { Pencil } from "lucide-react";
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
  // Dueña del registro — solo ella (o una admin) puede editarlo, mismo
  // criterio que aplica update_personal_use del lado del servidor.
  profileId: string;
  reimbursedAmount: number;
  reimbursedNote: string | null;
}

export function PersonalUseHistory({
  rows,
  currentProfileId,
  isAdmin,
}: {
  rows: PersonalUseRow[];
  currentProfileId: string;
  isAdmin: boolean;
}) {
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
            <Th>Nota</Th>
            <Th className="pr-5" />
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r) => {
            const canEdit = r.profileId === currentProfileId || isAdmin;
            const net = r.value - r.reimbursedAmount;
            return (
              <Tr key={r.id}>
                <Td className="pl-5">{formatDate(r.usedAt)}</Td>
                <Td>{r.label}</Td>
                <Td className="text-ink/60">{r.profileName}</Td>
                <Td numeric>{r.quantity}</Td>
                <Td numeric>
                  {r.reimbursedAmount > 0 ? (
                    <span className="whitespace-nowrap text-xs">
                      Valor: {formatCurrency(r.value)} · Reembolsado: {formatCurrency(r.reimbursedAmount)} · Neto:{" "}
                      <span className="font-semibold">{formatCurrency(net)}</span>
                    </span>
                  ) : (
                    formatCurrency(r.value)
                  )}
                </Td>
                <Td className="text-ink/60">
                  {r.note ?? "—"}
                  {r.reimbursedNote && (
                    <span className="block text-xs text-ink/50">Le pagó: {r.reimbursedNote}</span>
                  )}
                </Td>
                <Td className="pr-5">
                  {canEdit && (
                    <Link
                      href={`/inventario/uso-personal/${r.id}`}
                      aria-label="Editar registro"
                      className="flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Link>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      <p className="border-t border-ink/10 px-5 py-3 text-right text-sm text-ink/60">
        Valor total al costo:{" "}
        <span className="font-mono text-base tabular-nums text-ink">{formatCurrency(totalValue)}</span>
      </p>
    </>
  );
}
