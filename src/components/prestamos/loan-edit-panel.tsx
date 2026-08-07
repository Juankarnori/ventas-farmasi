"use client";

import { useMemo, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";
import { formatDate } from "@/lib/utils/date";
import type { LoanableProduct } from "./loan-form";
import type { LoanValuationType, LoanSettlementMethod } from "@/lib/types/database.types";

const VALUATION_LABEL: Record<LoanValuationType, string> = {
  costo: "Al costo",
  pvp: "A precio de venta",
};

export interface LoanEditData {
  id: string;
  productLabel: string;
  variantId: string;
  quantity: number;
  fromName: string;
  toName: string;
  loanDate: string;
  note: string | null;
  valuationType: LoanValuationType;
}

// Edición completa de un préstamo mientras sigue 'pendiente' (variante,
// cantidad, valoración, nota) — mismo patrón vista/edición+confirmación
// que SaleEditPanel: si la cantidad baja o cambia de variante, el stock
// se reacomoda al guardar (ver update_loan), así que se avisa antes.
export function LoanEditPanel({
  loan,
  products,
  categories,
  lines,
  action,
}: {
  loan: LoanEditData;
  products: LoanableProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const skipConfirmRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productOfVariant = useMemo(
    () => products.find((p) => p.variants.some((v) => v.id === loan.variantId)),
    [products, loan.variantId],
  );

  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterLineId, setFilterLineId] = useState("");

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (filterCategoryId && p.category_id !== filterCategoryId) return false;
        if (filterLineId && p.line_id !== filterLineId) return false;
        return true;
      }),
    [products, filterCategoryId, filterLineId],
  );

  function onFilterCategoryChange(id: string) {
    setFilterCategoryId(id);
    setFilterLineId("");
  }

  const [productId, setProductId] = useState(() => productOfVariant?.id ?? products[0]?.id ?? "");
  const [variantId, setVariantId] = useState(loan.variantId);
  const selectedProduct = productById.get(productId);

  const productOptions =
    filteredProducts.length === 0 || filteredProducts.some((p) => p.id === productId)
      ? filteredProducts
      : selectedProduct
        ? [selectedProduct, ...filteredProducts]
        : filteredProducts;

  function onProductChange(id: string) {
    setProductId(id);
    setVariantId(productById.get(id)?.variants[0]?.id ?? "");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (skipConfirmRef.current) {
      skipConfirmRef.current = false;
      return;
    }

    const formData = new FormData(e.currentTarget);
    const nextVariantId = String(formData.get("variant_id") ?? "");
    const nextQuantity = Number(formData.get("quantity"));

    // Bajar la cantidad o cambiar de variante mueve stock entre las dos
    // cuentas al guardar (se revierte lo viejo y se aplica lo nuevo) — se
    // avisa antes, igual que al editar una venta.
    const changesStock = nextVariantId !== loan.variantId || nextQuantity < loan.quantity;

    if (changesStock) {
      e.preventDefault();
      setConfirmOpen(true);
    }
  }

  function confirmAndSubmit() {
    setConfirmOpen(false);
    skipConfirmRef.current = true;
    formRef.current?.requestSubmit();
  }

  if (!editing) {
    return (
      <Card className="mt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-ink">{loan.productLabel}</p>
            <p className="mt-1 text-sm text-ink/60">
              {loan.fromName} → {loan.toName} · {loan.quantity} unidad{loan.quantity === 1 ? "" : "es"}
            </p>
            <p className="mt-1 text-xs text-ink/50">{formatDate(loan.loanDate)}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="sage">{VALUATION_LABEL[loan.valuationType]}</Badge>
        </div>
        {loan.note && <p className="mt-3 text-sm text-ink/70">{loan.note}</p>}
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-6">
        <form ref={formRef} action={action} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CategoryLineFilter
            categories={categories}
            lines={lines}
            categoryId={filterCategoryId}
            lineId={filterLineId}
            onCategoryChange={onFilterCategoryChange}
            onLineChange={setFilterLineId}
          />

          <div>
            <Label htmlFor="product_id">Producto</Label>
            <Select id="product_id" value={productId} onChange={(e) => onProductChange(e.target.value)}>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="variant_id">Color</Label>
            <Select
              id="variant_id"
              name="variant_id"
              required
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {selectedProduct?.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.color_name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-32">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input id="quantity" name="quantity" type="number" min={1} defaultValue={loan.quantity} required />
          </div>

          <div>
            <Label htmlFor="valuation_type">Si no se devuelve, se valora...</Label>
            <Select id="valuation_type" name="valuation_type" defaultValue={loan.valuationType}>
              <option value="costo">Al costo (para completar un pedido/reposición)</option>
              <option value="pvp">A precio de venta (para que lo venda ella)</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea id="note" name="note" rows={2} defaultValue={loan.note ?? ""} />
          </div>

          <div className="flex gap-2">
            <Button type="submit">Guardar cambios</Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
          </div>
        </form>
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="¿Confirmar cambios?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Estás por cambiar de producto/color o reducir la cantidad prestada — esa diferencia de
            stock se reacomoda entre las dos cuentas al guardar. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Volver
            </Button>
            <Button type="button" variant="outline" onClick={confirmAndSubmit}>
              Sí, guardar cambios
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// Edición liviana de cómo se pagó/devolvió un préstamo ya resuelto como
// 'vendido' — no toca stock ni cantidades, mismo patrón que
// PaymentMethodEditor en Ventas.
export function LoanSettlementEditor({
  loanId,
  settlementMethod,
  settlementBankNote,
  action,
}: {
  loanId: string;
  settlementMethod: LoanSettlementMethod | null;
  settlementBankNote: string | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState(settlementMethod ?? "efectivo");

  const METHOD_LABEL: Record<string, string> = {
    efectivo: "💵 Efectivo",
    transferencia: "🏦 Transferencia",
    producto: "📦 Devuelto en producto",
  };

  if (!editing) {
    return (
      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-ink/70">
            {settlementMethod ? (
              <span>
                {METHOD_LABEL[settlementMethod]}
                {settlementBankNote && ` · ${settlementBankNote}`}
              </span>
            ) : (
              <span className="text-ink/50">Todavía no se registró cómo se va a pagar.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5" /> {settlementMethod ? "Editar" : "Registrar"} pago
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <form
        action={action}
        onSubmit={() => setEditing(false)}
        id={`loan-settlement-${loanId}`}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-56">
          <Label htmlFor="settlement_method">Cómo se pagó/devolvió</Label>
          <Select
            id="settlement_method"
            name="settlement_method"
            value={method}
            onChange={(e) => setMethod(e.target.value as LoanSettlementMethod)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia bancaria</option>
            <option value="producto">Devuelto en producto</option>
          </Select>
        </div>
        {method === "transferencia" && (
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="settlement_bank_note">Banco (opcional)</Label>
            <Input
              id="settlement_bank_note"
              name="settlement_bank_note"
              placeholder="Ej: Banco Pichincha"
              defaultValue={settlementBankNote ?? ""}
            />
          </div>
        )}
        <Button type="submit" size="sm">
          Guardar
        </Button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancelar edición"
          className="rounded-full p-2 text-ink/40 hover:bg-ink/5"
        >
          <X className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
}
