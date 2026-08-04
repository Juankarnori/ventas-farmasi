"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const HOLD_DELAY_MS = 500;
const HOLD_REPEAT_MS = 120;

export interface StockStepperProps {
  value: number;
  onAdjust: (delta: number) => Promise<{ error?: string }>;
  min?: number;
  disabled?: boolean;
  className?: string;
}

// Selector +/- reutilizable para stock. El número mostrado solo cambia
// cuando `onAdjust` confirma el ajuste (nunca antes) — si el server o la
// llamada rechazan el cambio, queda como estaba y se ve el error acá
// mismo, nunca como un crash de página completa.
export function StockStepper({ value, onAdjust, min = 0, disabled, className }: StockStepperProps) {
  const [display, setDisplay] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si `value` cambia desde afuera (ej. router.refresh() trajo el valor
  // confirmado por el server), resincronizamos durante el render en vez
  // de un efecto, siguiendo el patrón recomendado de React para "ajustar
  // estado cuando cambia una prop" sin renders en cascada.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplay(value);
  }

  // Refs espejo de estado para leer siempre el valor mas reciente desde
  // dentro del interval del click sostenido (que se crea una sola vez al
  // apretar y no se vuelve a crear en cada render).
  const displayRef = useRef(display);
  displayRef.current = display;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const holdTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const holdEngaged = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearHold();
    };
  }, []);

  function clearHold() {
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdTimeout.current = undefined;
    holdInterval.current = undefined;
  }

  async function applyDelta(delta: number) {
    if (pendingRef.current) return;
    if (delta < 0 && displayRef.current + delta < min) return;

    pendingRef.current = true;
    setPending(true);
    setError(null);

    try {
      const result = await onAdjust(delta);
      if (!mounted.current) return;
      if (result?.error) {
        setError(result.error);
      } else {
        setDisplay((d) => d + delta);
      }
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "No se pudo ajustar el stock. Intentá de nuevo.");
    } finally {
      pendingRef.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function onPressStart(delta: number) {
    clearHold();
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        holdEngaged.current = true;
        void applyDelta(delta);
      }, HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  }

  function onPressEnd() {
    clearHold();
  }

  function onButtonClick(delta: number) {
    if (holdEngaged.current) {
      holdEngaged.current = false;
      return;
    }
    void applyDelta(delta);
  }

  const canDecrement = !disabled && display > min;
  const canIncrement = !disabled;

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          aria-label="Restar 1"
          disabled={!canDecrement}
          onMouseDown={() => onPressStart(-1)}
          onMouseUp={onPressEnd}
          onMouseLeave={onPressEnd}
          onTouchStart={() => onPressStart(-1)}
          onTouchEnd={onPressEnd}
          onClick={() => onButtonClick(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <span className="w-8 text-center font-mono text-sm tabular-nums text-ink">{display}</span>

        <button
          type="button"
          aria-label="Sumar 1"
          disabled={!canIncrement}
          onMouseDown={() => onPressStart(1)}
          onMouseUp={onPressEnd}
          onMouseLeave={onPressEnd}
          onTouchStart={() => onPressStart(1)}
          onTouchEnd={onPressEnd}
          onClick={() => onButtonClick(1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/40" aria-label="Guardando" />}
      </div>

      {error && (
        <p className="max-w-[10rem] rounded-md bg-accent/20 px-1.5 py-0.5 text-[11px] leading-tight text-ink">
          {error}
        </p>
      )}
    </div>
  );
}
