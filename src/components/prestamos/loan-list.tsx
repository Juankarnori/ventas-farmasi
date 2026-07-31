import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { markLoanReturned } from "@/app/(app)/prestamos/actions";

export interface LoanRow {
  id: string;
  productName: string;
  quantity: number;
  fromName: string;
  toName: string;
  loanDate: string;
  note: string | null;
  status: "pendiente" | "devuelto";
}

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
              <Badge variant={loan.status === "devuelto" ? "sage" : "gold"}>
                {loan.status === "devuelto" ? "Devuelto" : "Pendiente"}
              </Badge>
            </Td>
            <Td>
              {loan.status === "pendiente" && (
                <form action={markLoanReturned.bind(null, loan.id)}>
                  <button
                    type="submit"
                    className="rounded-full px-3 py-1.5 text-xs text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                  >
                    Marcar devuelto
                  </button>
                </form>
              )}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
