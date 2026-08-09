// Precio unitario de un préstamo según su tipo de valoración: al costo
// si era para ayudar a completar un pedido/reposición, a precio de venta
// si era para que la otra lo venda ella misma (ahí quien prestó perdió la
// ganancia que hubiera hecho), o al precio manual de promoción si el
// producto se compró a un precio puntual distinto de los dos anteriores
// (ej. protectores solares en oferta). Única fuente de este cálculo —
// tanto el valor "en vivo" del formulario (con el costo/precio del
// catálogo) como el guardado de un préstamo ya creado pasan por acá, para
// que nunca puedan mostrar números distintos entre sí.
export function loanUnitValue(params: {
  valuationType: "costo" | "pvp" | "promocion";
  unitCost: number;
  unitPrice: number;
  customPrice: number | null;
}): number {
  if (params.valuationType === "promocion") return params.customPrice ?? 0;
  if (params.valuationType === "pvp") return params.unitPrice;
  return params.unitCost;
}

// Cuánto vale la deuda de un préstamo "vendido" (no devuelto) — o, para
// cualquier otro estado, cuánto vale el préstamo en sí: precio unitario
// (ver loanUnitValue) × cantidad. Una sola función para los lugares que
// necesitan este número (formulario, detalle y listado de Préstamos, y
// Finanzas), para que no se pueda calcular distinto en cada uno.
export function loanDebtAmount(loan: {
  quantity: number;
  unit_cost: number;
  unit_price: number;
  valuation_type: "costo" | "pvp" | "promocion";
  custom_price: number | null;
}): number {
  return (
    loanUnitValue({
      valuationType: loan.valuation_type,
      unitCost: loan.unit_cost,
      unitPrice: loan.unit_price,
      customPrice: loan.custom_price,
    }) * loan.quantity
  );
}

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
