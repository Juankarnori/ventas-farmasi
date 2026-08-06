"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils/cn";
import { IDENTITY_COLORS } from "@/lib/utils/identity-colors";
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

  const swatch = IDENTITY_COLORS[color] ?? IDENTITY_COLORS.teal;
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Sesión de ${displayName}, abrir menú`}
        className="flex items-center gap-2 overflow-hidden rounded-full py-1 pl-1 pr-3 ring-1 ring-gold/40 transition-shadow hover:ring-gold/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            swatch.bgClass,
            swatch.textClass,
          )}
          aria-hidden
        >
          {initial}
        </span>
        <span className="max-w-[8rem] truncate text-sm font-medium text-ink">{displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-gold/20 bg-surface p-2 shadow-lg">
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
