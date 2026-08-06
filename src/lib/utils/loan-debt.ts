export interface DebtEntry {
  fromProfileId: string; // acreedor: a quien le compraron el producto prestado
  fromName: string;
  toProfileId: string; // deudor: quien lo vendió en vez de devolverlo
  toName: string;
  amount: number;
}

export interface NetDebtLine {
  creditorId: string;
  creditorName: string;
  debtorId: string;
  debtorName: string;
  amount: number;
}

// Neto de deuda monetaria por productos prestados y vendidos (no
// devueltos), agrupado por cada PAR de personas involucradas. Con más de
// 2 perfiles puede haber varias deudas cruzadas al mismo tiempo, cada una
// entre un par distinto — por eso devuelve una lista, no un solo número.
export function computeNetDebts(debts: DebtEntry[]): NetDebtLine[] {
  interface PairAcc {
    aId: string;
    aName: string;
    bId: string;
    bName: string;
    net: number; // positivo = b le debe a a; negativo = a le debe a b
  }

  const byPair = new Map<string, PairAcc>();

  for (const d of debts) {
    const [aId, aName, bId, bName] =
      d.fromProfileId < d.toProfileId
        ? [d.fromProfileId, d.fromName, d.toProfileId, d.toName]
        : [d.toProfileId, d.toName, d.fromProfileId, d.fromName];

    const key = `${aId}:${bId}`;
    const acc = byPair.get(key) ?? { aId, aName, bId, bName, net: 0 };
    const sign = d.fromProfileId === aId ? 1 : -1;
    acc.net += sign * d.amount;
    byPair.set(key, acc);
  }

  const lines: NetDebtLine[] = [];
  for (const acc of byPair.values()) {
    if (acc.net === 0) continue;
    lines.push(
      acc.net > 0
        ? { creditorId: acc.aId, creditorName: acc.aName, debtorId: acc.bId, debtorName: acc.bName, amount: acc.net }
        : { creditorId: acc.bId, creditorName: acc.bName, debtorId: acc.aId, debtorName: acc.aName, amount: -acc.net },
    );
  }
  return lines;
}
