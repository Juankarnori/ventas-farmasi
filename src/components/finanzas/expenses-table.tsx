import { Trash2 } from "lucide-react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { deleteExpense } from "@/app/(app)/finanzas/actions";
import type { ExpenseCategory } from "@/lib/types/database.types";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  envio: "Envío",
  empaque: "Empaque",
  publicidad: "Publicidad",
  otro: "Otro",
};

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
}

export function ExpensesTable({ expenses }: { expenses: ExpenseRow[] }) {
  if (expenses.length === 0) {
    return <p className="py-6 text-center text-sm text-ink/50">No hay gastos registrados.</p>;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Fecha</Th>
          <Th>Categoría</Th>
          <Th>Descripción</Th>
          <Th className="text-right">Monto</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {expenses.map((e) => (
          <Tr key={e.id}>
            <Td>{formatDate(e.expense_date)}</Td>
            <Td>{CATEGORY_LABELS[e.category]}</Td>
            <Td className="text-ink/60">{e.description ?? "—"}</Td>
            <Td numeric>{formatCurrency(e.amount)}</Td>
            <Td>
              <form action={deleteExpense.bind(null, e.id)}>
                <button
                  type="submit"
                  aria-label="Eliminar gasto"
                  className="rounded-full p-1.5 text-ink/40 hover:bg-accent/20 hover:text-ink"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
