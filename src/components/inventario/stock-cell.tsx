"use client";

import { useRouter } from "next/navigation";
import { StockStepper } from "@/components/ui/stock-stepper";
import { adjustStock } from "@/app/(app)/inventario/actions";

export function StockCell({
  variantId,
  stock,
  canAdjust,
}: {
  variantId: string;
  stock: number;
  canAdjust: boolean;
}) {
  const router = useRouter();

  if (!canAdjust) {
    return <span className="font-mono text-sm tabular-nums text-ink">{stock}</span>;
  }

  async function handleAdjust(delta: number) {
    try {
      await adjustStock(variantId, delta);
      router.refresh();
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo ajustar el stock. Intentá de nuevo." };
    }
  }

  return <StockStepper value={stock} onAdjust={handleAdjust} />;
}
