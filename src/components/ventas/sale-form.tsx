"use client";

import { useState } from "react";
import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SaleLineItems, type SellableProduct } from "./sale-line-items";
import { todayISO } from "@/lib/utils/date";

export function SaleForm({
  products,
  saleAction,
  apartadoAction,
}: {
  products: SellableProduct[];
  saleAction: (formData: FormData) => void | Promise<void>;
  apartadoAction: (formData: FormData) => void | Promise<void>;
}) {
  const [isApartado, setIsApartado] = useState(false);

  return (
    <form action={isApartado ? apartadoAction : saleAction} className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-lg border border-ink/10 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={isApartado}
            onChange={(e) => setIsApartado(e.target.checked)}
          />
          Es un apartado (paga con abonos)
        </label>
        <p className="text-xs text-ink/50">
          {isApartado
            ? "El stock queda reservado ya mismo; la ganancia entra a Finanzas recién cuando termine de pagar."
            : "Pago completo de contado — igual que siempre."}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Label htmlFor="sale_date">Fecha</Label>
          <Input id="sale_date" name="sale_date" type="date" defaultValue={todayISO()} required />
        </div>
        {isApartado ? (
          <>
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="customer_name">Nombre de la clienta</Label>
              <Input id="customer_name" name="customer_name" placeholder="Nombre de la clienta" required />
            </div>
            <div className="w-44">
              <Label htmlFor="customer_phone">Teléfono (opcional)</Label>
              <Input id="customer_phone" name="customer_phone" placeholder="Ej: 11 5555 5555" />
            </div>
          </>
        ) : (
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="customer_name">Cliente (opcional)</Label>
            <Input id="customer_name" name="customer_name" placeholder="Nombre de la clienta" />
          </div>
        )}
      </div>

      <SaleLineItems products={products} />

      <Button type="submit" disabled={products.length === 0}>
        {isApartado ? "Crear apartado" : "Registrar venta"}
      </Button>
    </form>
  );
}
