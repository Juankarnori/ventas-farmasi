import type { ProfileSlot } from "@/lib/types/database.types";

export interface DebtEntry {
  fromSlot: ProfileSlot;
  toSlot: ProfileSlot;
  amount: number;
}

// Neto de deuda monetaria por productos prestados y vendidos (no
// devueltos). Positivo = "yo" le debe a "mama"; negativo = "mama" le debe
// a "yo". Como solo hay dos perfiles, alcanza con un signo (no hace falta
// netear par por par como con productos físicos distintos).
export function computeNetDebt(debts: DebtEntry[]) {
  let net = 0;
  for (const d of debts) {
    net += d.toSlot === "yo" ? d.amount : -d.amount;
  }
  return net;
}
