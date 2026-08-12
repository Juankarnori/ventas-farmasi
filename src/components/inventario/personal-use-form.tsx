"use client";

import { useMemo, useRef, useState } from "react";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";
import { filterProducts } from "@/lib/utils/product-search";
import { todayISO } from "@/lib/utils/date";

export interface PersonalUseProduct {
  id: string;
  name: string;
  category_id: string | null;
  line_id: string | null;
  variants: { id: string; color_name: string; stock: number; sku: string | null }[];
}

// Precarga de un registro ya hecho, para editarlo. `stock` de cada
// variante en `products` no se usa en modo edición (ver más abajo, mismo
// criterio que LoanEditPanel: el catálogo completo se pasa sin filtrar
// por stock disponible, así que ese número no sería confiable acá).
export interface PersonalUseDefaults {
  variantId: string;
  quantity: number;
  usedAt: string;
  note: string | null;
  reimbursedAmount: number;
  reimbursedNote: string | null;
}

// Alta y edición de un registro de uso personal comparten este mismo
// formulario (mismo criterio que FollowUpRuleForm): sin `defaults` es de
// alta, con `defaults` es de edición. La única diferencia real de
// comportamiento es que en edición no se filtra el catálogo por stock
// disponible (el registro puede ser de un producto/color que ya no tiene
// stock propio) ni se muestra "(tenés N)" — mismo motivo que
// LoanEditPanel.
export function PersonalUseForm({
  products,
  categories,
  lines,
  action,
  defaults,
  submitLabel = "Registrar uso personal",
  onCancel,
  onSuccess,
}: {
  products: PersonalUseProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  action: (formData: FormData) => Promise<{ error?: string }>;
  defaults?: PersonalUseDefaults;
  submitLabel?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const isEdit = !!defaults;
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFormData = useRef<FormData | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productOfVariant = useMemo(
    () => (defaults ? products.find((p) => p.variants.some((v) => v.id === defaults.variantId)) : undefined),
    [products, defaults],
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
  const [variantId, setVariantId] = useState(defaults?.variantId ?? products[0]?.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(defaults?.quantity ?? 1);
  const [showReimbursement, setShowReimbursement] = useState((defaults?.reimbursedAmount ?? 0) > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedProduct = productById.get(productId);
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === variantId);

  // Igual que en Catálogo/Pedidos/Ventas/Préstamos: las opciones del
  // select son la lista filtrada, más el producto ya elegido si el
  // filtro cambió después y ya no lo incluye — excepto con una búsqueda
  // de texto activa, ahí siempre se respeta la lista filtrada tal cual
  // (ver bug/fix en SaleLineItems).
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

  // Devuelve { error? } en vez de tirar una excepción — en producción,
  // Next.js oculta el mensaje real de cualquier throw no atrapado en una
  // Server Action, así que el único jeito confiable de mostrar el motivo
  // real es que la acción nunca lo lance como excepción.
  async function doSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await action(formData);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (!isEdit) {
      // Alta: se deja lista para cargar otra de una — el reset nativo del
      // form no alcanza para los campos controlados (producto/color/
      // cantidad/checkbox de reembolso).
      formRef.current?.reset();
      setProductId(products[0]?.id ?? "");
      setVariantId(products[0]?.variants[0]?.id ?? "");
      setQuantity(1);
      setShowReimbursement(false);
    }
    onSuccess?.();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (defaults) {
      const nextVariantId = String(formData.get("variant_id") ?? "");
      const nextQuantity = Number(formData.get("quantity"));
      // Cambiar de producto/color o bajar la cantidad reacomoda stock al
      // guardar (se revierte lo viejo y se aplica lo nuevo) — se avisa
      // antes, mismo criterio que LoanEditPanel/SaleEditPanel.
      const changesStock = nextVariantId !== defaults.variantId || nextQuantity < defaults.quantity;
      if (changesStock) {
        pendingFormData.current = formData;
        setConfirmOpen(true);
        return;
      }
    }

    void doSubmit(formData);
  }

  function confirmAndSubmit() {
    setConfirmOpen(false);
    if (pendingFormData.current) void doSubmit(pendingFormData.current);
  }

  if (products.length === 0 && !isEdit) {
    return <p className="text-sm text-ink/60">No tenés stock propio de ningún producto ahora mismo.</p>;
  }

  return (
    <>
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

        <div className="flex flex-wrap gap-3">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="pu_product_id">Producto</Label>
            <Select id="pu_product_id" value={productId} onChange={(e) => onProductChange(e.target.value)}>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px] flex-1">
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
                  {!isEdit && ` (tenés ${v.stock})`}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={!isEdit ? selectedVariant?.stock : undefined}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>
          <div className="w-40">
            <Label htmlFor="used_at">Fecha</Label>
            <Input id="used_at" name="used_at" type="date" defaultValue={defaults?.usedAt ?? todayISO()} required />
          </div>
        </div>

        <div>
          <Label htmlFor="pu_note">Nota (opcional)</Label>
          <Textarea
            id="pu_note"
            name="note"
            rows={2}
            defaultValue={defaults?.note ?? ""}
            placeholder="Ej: para uso propio en casa"
          />
        </div>

        <div className="rounded-lg border border-gold/20 bg-panel/30 p-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={showReimbursement}
              onChange={(e) => setShowReimbursement(e.target.checked)}
              className="h-4 w-4 rounded border-gold/40"
            />
            ¿Alguien te reembolsó parte de esto?
          </label>
          {showReimbursement && (
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="w-36">
                <Label htmlFor="reimbursed_amount">Monto reembolsado</Label>
                <Input
                  id="reimbursed_amount"
                  name="reimbursed_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={defaults?.reimbursedAmount || undefined}
                  placeholder="0.00"
                />
              </div>
              <div className="min-w-[180px] flex-1">
                <Label htmlFor="reimbursed_note">¿Quién te pagó? (opcional)</Label>
                <Input
                  id="reimbursed_note"
                  name="reimbursed_note"
                  placeholder="Ej: mi hermana"
                  defaultValue={defaults?.reimbursedNote ?? ""}
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" className="w-fit" disabled={busy}>
            {busy ? "Guardando..." : submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="¿Confirmar cambios?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Estás por cambiar de producto/color o reducir la cantidad — esa diferencia de stock se
            reacomoda al guardar. Esta acción no se puede deshacer.
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
