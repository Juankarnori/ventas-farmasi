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
import { filterProducts } from "@/lib/utils/product-search";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { loanUnitValue } from "@/lib/utils/loan-debt";
import type { LoanableProduct } from "./loan-form";
import type { LoanValuationType, LoanSettlementMethod } from "@/lib/types/database.types";

const VALUATION_LABEL: Record<LoanValuationType, string> = {
  costo: "Al costo",
  pvp: "A precio de venta",
  promocion: "En promoción",
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
  customPrice: number | null;
  // Costo/PVP tal como quedaron guardados en el préstamo (snapshot del
  // momento en que se prestó) — con esto se arma "Precio unitario ·
  // Total" en modo lectura, con la misma fórmula (loanUnitValue) que usa
  // el formulario y el listado.
  unitCost: number;
  unitPrice: number;
}

// Badge de valoración + "Precio unitario · Total" — mismo cálculo
// (loanUnitValue) en cualquier lado que necesite mostrar el valor de un
// préstamo ya creado: acá adentro (modo lectura) y en /prestamos/[id]
// para los estados que no pasan por LoanEditPanel (devuelto/vendido).
export function LoanValuationSummary({
  valuationType,
  unitCost,
  unitPrice,
  customPrice,
  quantity,
}: {
  valuationType: LoanValuationType;
  unitCost: number;
  unitPrice: number;
  customPrice: number | null;
  quantity: number;
}) {
  const unitValue = loanUnitValue({ valuationType, unitCost, unitPrice, customPrice });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="sage">{VALUATION_LABEL[valuationType]}</Badge>
      <span className="text-xs text-ink/60">
        Precio unitario: {formatCurrency(unitValue)} · Total: {formatCurrency(unitValue * quantity)}
      </span>
    </div>
  );
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
  action: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingFormData = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productOfVariant = useMemo(
    () => products.find((p) => p.variants.some((v) => v.id === loan.variantId)),
    [products, loan.variantId],
  );

  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterLineId, setFilterLineId] = useState("");
  const [query, setQuery] = useState("");

  const filteredProducts = useMemo(
    () => filterProducts(products, { categoryId: filterCategoryId, lineId: filterLineId, query }),
    [products, filterCategoryId, filterLineId, query],
  );

  function onFilterCategoryChange(id: string) {
    setFilterCategoryId(id);
    setFilterLineId("");
  }

  const [productId, setProductId] = useState(() => productOfVariant?.id ?? products[0]?.id ?? "");
  const [variantId, setVariantId] = useState(loan.variantId);
  const [valuationType, setValuationType] = useState(loan.valuationType);
  const [quantity, setQuantity] = useState(loan.quantity);
  const [customPrice, setCustomPrice] = useState(loan.customPrice != null ? String(loan.customPrice) : "");
  const customPriceNumber = Number(customPrice);
  const hasValidCustomPrice = customPrice !== "" && Number.isFinite(customPriceNumber) && customPriceNumber > 0;
  const selectedProduct = productById.get(productId);
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === variantId);

  // Mismo cálculo que en LoanForm y que loanDebtAmount — acá con el
  // costo/precio del catálogo (podría ser otra variante que la que tenía
  // el préstamo original) en vez del snapshot ya guardado.
  const effectiveCost = selectedVariant?.cost_override ?? selectedProduct?.cost_price ?? 0;
  const effectivePrice = selectedVariant?.price_override ?? selectedProduct?.sale_price ?? 0;
  const editUnitValue =
    valuationType === "promocion"
      ? hasValidCustomPrice
        ? customPriceNumber
        : null
      : loanUnitValue({
          valuationType,
          unitCost: effectiveCost,
          unitPrice: effectivePrice,
          customPrice: null,
        });

  // Misma excepción que en LoanForm: la selección actual solo se
  // "pega" a la lista filtrada cuando lo que la sacó fue el filtro de
  // categoría/línea, nunca con una búsqueda de texto activa (ver
  // bug/fix en SaleLineItems).
  const productOptions =
    filteredProducts.length === 0 || filteredProducts.some((p) => p.id === productId) || query.trim()
      ? filteredProducts
      : selectedProduct
        ? [selectedProduct, ...filteredProducts]
        : filteredProducts;

  function onProductChange(id: string) {
    setProductId(id);
    setVariantId(productById.get(id)?.variants[0]?.id ?? "");
  }

  // La Server Action devuelve { error? } en vez de tirar una excepción —
  // en producción, Next.js oculta el mensaje real de cualquier throw no
  // atrapado en una Server Action, así que el único jeito confiable de
  // mostrar el motivo real es que nunca se lance como excepción.
  async function doSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await action(formData);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      // Volver a modo lectura acá (recién cuando el guardado de verdad
      // terminó bien) le da a esta pantalla una señal clara de "esto se
      // guardó" — antes el formulario se quedaba tal cual con lo que la
      // usuaria había tipeado, así que un guardado fallido o exitoso se
      // veían exactamente igual en pantalla.
      setEditing(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nextVariantId = String(formData.get("variant_id") ?? "");
    const nextQuantity = Number(formData.get("quantity"));

    // Bajar la cantidad o cambiar de variante mueve stock entre las dos
    // cuentas al guardar (se revierte lo viejo y se aplica lo nuevo) — se
    // avisa antes, igual que al editar una venta.
    const changesStock = nextVariantId !== loan.variantId || nextQuantity < loan.quantity;

    if (changesStock) {
      pendingFormData.current = formData;
      setConfirmOpen(true);
      return;
    }

    void doSubmit(formData);
  }

  function confirmAndSubmit() {
    setConfirmOpen(false);
    if (pendingFormData.current) void doSubmit(pendingFormData.current);
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
        <div className="mt-3">
          <LoanValuationSummary
            valuationType={loan.valuationType}
            unitCost={loan.unitCost}
            unitPrice={loan.unitPrice}
            customPrice={loan.customPrice}
            quantity={loan.quantity}
          />
        </div>
        {loan.note && <p className="mt-3 text-sm text-ink/70">{loan.note}</p>}
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-6">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CategoryLineFilter
            categories={categories}
            lines={lines}
            categoryId={filterCategoryId}
            lineId={filterLineId}
            onCategoryChange={onFilterCategoryChange}
            onLineChange={setFilterLineId}
            query={query}
            onQueryChange={setQuery}
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
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <Label htmlFor="valuation_type">Si no se devuelve, se valora...</Label>
            <Select
              id="valuation_type"
              name="valuation_type"
              value={valuationType}
              onChange={(e) => setValuationType(e.target.value as LoanValuationType)}
            >
              <option value="costo">Al costo (para completar un pedido/reposición)</option>
              <option value="pvp">A precio de venta (para que lo venda ella)</option>
              <option value="promocion">En promoción (precio manual)</option>
            </Select>
            {editUnitValue !== null && (
              <p className="mt-1 text-xs font-medium text-ink/70">
                Precio unitario: {formatCurrency(editUnitValue)} · Total:{" "}
                {formatCurrency(editUnitValue * quantity)} ({quantity} unidad{quantity === 1 ? "" : "es"})
              </p>
            )}
          </div>

          {valuationType === "promocion" && (
            <div className="w-full max-w-xs">
              <Label htmlFor="custom_price">Precio de promoción (por unidad)</Label>
              <Input
                id="custom_price"
                name="custom_price"
                type="number"
                min={0.01}
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea id="note" name="note" rows={2} defaultValue={loan.note ?? ""} />
          </div>

          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando..." : "Guardar cambios"}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
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
  settlementAmount,
  settlementBankNote,
  // Deuda calculada (loanDebtAmount) — precarga el campo de monto con este
  // valor sugerido; queda editable por si hubo un ajuste manual entre las
  // dos (ej. redondeo, descuento de último momento).
  suggestedAmount,
  action,
}: {
  loanId: string;
  settlementMethod: LoanSettlementMethod | null;
  settlementAmount: number | null;
  settlementBankNote: string | null;
  suggestedAmount: number;
  action: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState(settlementMethod ?? "efectivo");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await action(new FormData(e.currentTarget));
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  }

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
                {settlementAmount != null && ` · ${formatCurrency(settlementAmount)}`}
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
      <div className="flex flex-col gap-2">
        <form
          onSubmit={handleSubmit}
          id={`loan-settlement-${loanId}`}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="w-32">
            <Label htmlFor="settlement_amount">Monto pagado</Label>
            <Input
              id="settlement_amount"
              name="settlement_amount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={settlementAmount ?? suggestedAmount}
              required
            />
          </div>
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
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Guardando..." : "Guardar"}
          </Button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={busy}
            aria-label="Cancelar edición"
            className="rounded-full p-2 text-ink/40 hover:bg-ink/5"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
        {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
      </div>
    </Card>
  );
}
