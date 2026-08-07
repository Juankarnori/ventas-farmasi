"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  getBorrowableStock,
  createLoanQuick,
  type BorrowableStockOption,
} from "@/app/(app)/prestamos/actions";

// Salida directa desde el aviso de "no tenés suficiente stock propio":
// arma el préstamo (mismo create_loan de siempre) sin salir del
// formulario de venta. `missingQuantity` es solo la diferencia que falta
// para completar el renglón — si ya tenía algo de stock propio, no pide
// prestada toda la cantidad de la venta, solo lo que falta.
export function BorrowStockDialog({
  variantId,
  missingQuantity,
  onBorrowed,
}: {
  variantId: string;
  missingQuantity: number;
  onBorrowed: (addedStock: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lenders, setLenders] = useState<BorrowableStockOption[]>([]);
  const [fromProfileId, setFromProfileId] = useState("");
  const [quantity, setQuantity] = useState(missingQuantity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDialog() {
    setOpen(true);
    setError(null);
    setLoading(true);
    try {
      const options = await getBorrowableStock(variantId);
      setLenders(options);
      setFromProfileId(options[0]?.profileId ?? "");
      setQuantity(Math.min(missingQuantity, options[0]?.stock ?? missingQuantity));
    } catch {
      setError("No se pudo buscar el stock de las demás usuarias. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function onLenderChange(profileId: string) {
    setFromProfileId(profileId);
    const lender = lenders.find((l) => l.profileId === profileId);
    setQuantity(Math.min(missingQuantity, lender?.stock ?? missingQuantity));
  }

  async function confirmBorrow() {
    if (!fromProfileId || quantity <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createLoanQuick(variantId, fromProfileId, quantity);
      if (result.error) {
        setError(result.error);
      } else {
        onBorrowed(quantity);
        setOpen(false);
      }
    } catch {
      setError("No se pudo crear el préstamo. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const selectedLender = lenders.find((l) => l.profileId === fromProfileId);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="mt-1.5 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <HandCoins className="h-3.5 w-3.5" /> Pedir prestado
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Pedir prestado">
        <div className="flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-ink/60">Buscando stock disponible...</p>
          ) : lenders.length === 0 ? (
            <p className="text-sm text-ink/60">
              Ninguna otra usuaria tiene stock de este color ahora mismo.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="borrow_from">Pedirle a</Label>
                <Select id="borrow_from" value={fromProfileId} onChange={(e) => onLenderChange(e.target.value)}>
                  {lenders.map((l) => (
                    <option key={l.profileId} value={l.profileId}>
                      {l.displayName} (tiene {l.stock})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-32">
                <Label htmlFor="borrow_quantity">Cantidad a pedir</Label>
                <Input
                  id="borrow_quantity"
                  type="number"
                  min={1}
                  max={selectedLender?.stock ?? missingQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>
            </>
          )}

          {error && <p className="rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            {lenders.length > 0 && (
              <Button type="button" onClick={confirmBorrow} disabled={busy || !fromProfileId}>
                {busy ? "Creando..." : "Pedir prestado"}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
