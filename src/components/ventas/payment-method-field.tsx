"use client";

import { useState } from "react";
import { Label, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { PaymentMethod } from "@/lib/types/database.types";

// Campo de método de pago reutilizado en el alta de venta/apartado y en
// la edición de una venta existente. El campo de banco solo aparece
// cuando corresponde (transferencia) — nunca se manda una nota de banco
// "colgada" en una venta en efectivo, ni acá ni del lado del servidor
// (las funciones de la base también la fuerzan a null si el método es
// 'efectivo', por si alguien arma el POST a mano).
export function PaymentMethodField({
  defaultMethod = "efectivo",
  defaultBankNote,
}: {
  defaultMethod?: PaymentMethod;
  defaultBankNote?: string | null;
}) {
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-56">
        <Label htmlFor="payment_method">Método de pago</Label>
        <Select
          id="payment_method"
          name="payment_method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia bancaria</option>
        </Select>
      </div>
      {method === "transferencia" && (
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="bank_note">Banco (opcional)</Label>
          <Input
            id="bank_note"
            name="bank_note"
            placeholder="Ej: Banco Pichincha"
            defaultValue={defaultBankNote ?? ""}
          />
        </div>
      )}
    </div>
  );
}
