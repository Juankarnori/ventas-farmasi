"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "./button";

// Botón reutilizable para una Server Action simple sin confirmación
// (marcar entregado, marcar recibido, etc.): llama `action` por onClick
// (no <form action={...}>) y muestra `result.error` inline si lo hay —
// nunca se lanza como excepción, así que nunca se pierde el mensaje real
// detrás de la pantalla genérica de error de Next.js en producción.
export function ActionButton({
  action,
  onSuccess,
  children,
  ...buttonProps
}: {
  action: () => Promise<{ error?: string }>;
  onSuccess?: () => void;
  children: React.ReactNode;
} & Omit<ButtonProps, "onClick" | "type">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result?.error) {
      setError(result.error);
    } else {
      onSuccess?.();
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <Button type="button" onClick={handleClick} disabled={busy || buttonProps.disabled} {...buttonProps}>
        {children}
      </Button>
      {error && <p className="max-w-xs rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{error}</p>}
    </div>
  );
}
