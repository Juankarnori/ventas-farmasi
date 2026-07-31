"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils/cn";
import type { ProfileColor } from "@/lib/types/database.types";

export function IdentityPill({
  displayName,
  color,
}: {
  displayName: string;
  color: ProfileColor;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isTurquoise = color === "turquoise";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Sesión de ${displayName}, abrir menú`}
        className="flex items-center overflow-hidden rounded-full ring-1 ring-gold/40 transition-shadow hover:ring-gold/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span
          className={cn(
            "flex h-9 items-center px-3 text-xs font-semibold text-background",
            isTurquoise ? "bg-primary" : "bg-accent/40",
          )}
        >
          M
        </span>
        <span
          className={cn(
            "flex h-9 items-center gap-1.5 px-3 text-xs font-semibold text-background",
            isTurquoise ? "bg-primary/40" : "bg-accent",
          )}
        >
          Y
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-gold/20 bg-background p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs text-ink/50">
            Sesión de <span className="font-medium text-ink">{displayName}</span>
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-ink/5"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
