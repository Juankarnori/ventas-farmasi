"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { revokeAuthorizedEmail } from "@/app/(app)/equipo/actions";

export function RevokeEmailButton({ email, hasProfile }: { email: string; hasProfile: boolean }) {
  const [open, setOpen] = useState(false);
  const action = revokeAuthorizedEmail.bind(null, email);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ink/60 hover:bg-accent/20 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <Ban className="h-3.5 w-3.5" /> Revocar
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="¿Revocar este acceso?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            <span className="font-medium text-ink">{email}</span> ya no va a poder entrar a la
            app.
            {hasProfile && (
              <>
                {" "}
                Su perfil no se borra —{" "}
                <strong className="text-ink">
                  todo su historial de ventas, pedidos y préstamos se conserva
                </strong>{" "}
                — solo pierde el acceso a futuro.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <form action={action}>
              <Button type="submit" variant="outline">
                Sí, revocar
              </Button>
            </form>
          </div>
        </div>
      </Dialog>
    </>
  );
}
