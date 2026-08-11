"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, X } from "lucide-react";
import { formatDate } from "@/lib/utils/date";

export interface UpcomingAppointment {
  id: string;
  prospectId: string;
  prospectName: string;
  scheduledAt: string;
}

// NO hay infraestructura de push notifications en este proyecto todavía
// (el service worker de public/sw.js solo cachea assets estáticos, sin
// VAPID ni subscriptions) — así que el recordatorio de "10 minutos antes
// de la cita" es esta alternativa visible dentro de la app: mientras
// esté abierta, revisa cada 20s si alguna cita propia cae en la ventana
// [-5, +10] minutos desde ahora y la muestra acá arriba. A diferencia de
// un push, esto NO llega si la app está cerrada — solo mientras se está
// mirando.
const DISMISSED_KEY = "farmasi-bella-dismissed-appointments";
const CHECK_INTERVAL_MS = 20_000;
const MINUTES_BEFORE = 10;
const MINUTES_AFTER_GRACE = 5;

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function AppointmentReminderBanner({ appointments }: { appointments: UpcomingAppointment[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // El primer cálculo de "ahora" se difiere a un callback (setTimeout)
    // en vez de llamarse directo en el cuerpo del efecto — hacerlo
    // síncrono ahí dispara "cascading renders" (regla
    // react-hooks/set-state-in-effect); en un timer, en cambio, es
    // exactamente el patrón recomendado de "suscribirse a un sistema
    // externo" (acá, el reloj).
    function tick() {
      setNow(Date.now());
    }
    const firstTick = setTimeout(() => {
      tick();
      setDismissed(readDismissed());
    }, 0);
    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(firstTick);
      clearInterval(interval);
    };
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  // `now` arranca null (recién se calcula en el cliente, después del
  // montaje) para no arriesgar un mismatch de hidratación entre el
  // render del servidor y el del navegador.
  if (now === null || appointments.length === 0) return null;

  const due = appointments.filter((a) => {
    if (dismissed.has(a.id)) return false;
    const diffMinutes = (new Date(a.scheduledAt).getTime() - now) / 60_000;
    return diffMinutes <= MINUTES_BEFORE && diffMinutes >= -MINUTES_AFTER_GRACE;
  });

  if (due.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {due.map((a) => {
        const diffMinutes = Math.round((new Date(a.scheduledAt).getTime() - now) / 60_000);
        const label =
          diffMinutes > 0 ? `en ${diffMinutes} min` : diffMinutes === 0 ? "ahora" : `hace ${Math.abs(diffMinutes)} min`;

        return (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-accent/20 px-4 py-3 shadow-sm"
          >
            <Link
              href={`/clientes/prospectos/${a.prospectId}`}
              className="flex min-w-0 items-center gap-2 text-sm text-ink"
            >
              <Calendar className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">
                Cita con <strong className="font-semibold">{a.prospectName}</strong> {label} —{" "}
                {formatDate(a.scheduledAt, "HH:mm")}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              aria-label="Cerrar aviso"
              className="shrink-0 rounded-full p-1 text-ink/40 hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
