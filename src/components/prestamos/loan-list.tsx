"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
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
              <div className="flex flex-wrap items-center gap-2">
                {loan.status === "pendiente" && (
                  <>
                    <ActionButton
                      action={markLoanReturned.bind(null, loan.id)}
                      variant="ghost"
                      size="sm"
                      className="px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
                    >
                      Marcar devuelto
                    </ActionButton>
                    <ActionButton
                      action={markLoanSold.bind(null, loan.id)}
                      variant="ghost"
                      size="sm"
                      className="px-3 py-1.5 text-xs text-ink/60 hover:bg-accent/20 hover:text-ink"
                    >
                      Marcar vendido
                    </ActionButton>
                  </>
                )}
                {loan.status === "vendido" && (
                  <span className="text-xs text-ink/60">
                    {loan.debtSettled ? "Deuda liquidada" : `Debe ${formatCurrency(loan.debtAmount)}`}
                  </span>
                )}
                <Link
                  href={`/prestamos/${loan.id}`}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {loan.status === "vendido" ? "Registrar pago" : "Editar"}
                </Link>
              </div>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
