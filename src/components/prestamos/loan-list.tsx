import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { markLoanReturned, markLoanSold } from "@/app/(app)/prestamos/actions";

export interface LoanRow {
  id: string;
  productName: string;
  quantity: number;
  fromName: string;
  toName: string;
  loanDate: string;
  note: string | null;
  status: "pendiente" | "devuelto" | "vendido";
  debtAmount: number;
  debtSettled: boolean;
}

const STATUS_LABEL: Record<LoanRow["status"], string> = {
  pendiente: "Pendiente",
  devuelto: "Devuelto",
  vendido: "Vendido",
};

const STATUS_VARIANT: Record<LoanRow["status"], "gold" | "sage" | "accent"> = {
  pendiente: "gold",
  devuelto: "sage",
  vendido: "accent",
};

export function LoanList({ loans }: { loans: LoanRow[] }) {
  if (loans.length === 0) {
    return <p className="py-6 text-center text-sm text-ink/50">No hay préstamos acá.</p>;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Fecha</Th>
          <Th>Producto</Th>
          <Th>De → A</Th>
          <Th className="text-right">Cant.</Th>
          <Th>Estado</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        {loans.map((loan) => (
          <Tr key={loan.id}>
            <Td>{formatDate(loan.loanDate)}</Td>
            <Td>{loan.productName}</Td>
            <Td className="text-ink/70">
              {loan.fromName} → {loan.toName}
            </Td>
            <Td numeric>{loan.quantity}</Td>
            <Td>
              <Badge variant={STATUS_VARIANT[loan.status]}>{STATUS_LABEL[loan.status]}</Badge>
            </Td>
            <Td>
              {loan.status === "pendiente" && (
                <div className="flex gap-2">
                  <form action={markLoanReturned.bind(null, loan.id)}>
                    <button
                      type="submit"
                      className="rounded-full px-3 py-1.5 text-xs text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                    >
                      Marcar devuelto
                    </button>
                  </form>
                  <form action={markLoanSold.bind(null, loan.id)}>
                    <button
                      type="submit"
                      className="rounded-full px-3 py-1.5 text-xs text-ink/60 hover:bg-accent/20 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                    >
                      Marcar vendido
                    </button>
                  </form>
                </div>
              )}
              {loan.status === "vendido" && (
                <span className="text-xs text-ink/60">
                  {loan.debtSettled ? "Deuda liquidada" : `Debe ${formatCurrency(loan.debtAmount)}`}
                </span>
              )}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
