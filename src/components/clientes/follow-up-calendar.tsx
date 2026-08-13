"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  getDate,
} from "date-fns";
import { es } from "date-fns/locale";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { cn } from "@/lib/utils/cn";
import { todayISO } from "@/lib/utils/date";
import type { CalendarFollowUpEntry, CalendarBirthdayEntry } from "@/lib/queries/calendar-follow-ups";

const STATUS_DOT: Record<CalendarFollowUpEntry["status"], string> = {
  pendiente: "bg-gold",
  hecho: "bg-sage",
  omitido: "bg-ink/25",
};

const STATUS_LABEL: Record<CalendarFollowUpEntry["status"], string> = {
  pendiente: "Pendiente",
  hecho: "Contactada",
  omitido: "Omitida",
};

export function FollowUpCalendar({
  year,
  month,
  followUps,
  birthdays,
}: {
  year: number;
  month: number; // 1-12
  followUps: CalendarFollowUpEntry[];
  birthdays: CalendarBirthdayEntry[];
}) {
  const viewedMonth = new Date(year, month - 1, 1);

  // "Hoy" en la hora de Ecuador, no la del entorno donde se renderiza
  // (ver todayISO) — evita que el día resaltado/preseleccionado se corra
  // durante la tarde/noche si esto llega a renderizarse en el servidor.
  const [todayYear, todayMonthNum, todayDay] = todayISO().split("-").map(Number);
  const todayDate = new Date(todayYear, todayMonthNum - 1, todayDay);

  const followUpsByDay = useMemo(() => {
    const map = new Map<number, CalendarFollowUpEntry[]>();
    for (const f of followUps) {
      const list = map.get(f.day) ?? [];
      list.push(f);
      map.set(f.day, list);
    }
    return map;
  }, [followUps]);

  const birthdaysByDay = useMemo(() => {
    const map = new Map<number, CalendarBirthdayEntry[]>();
    for (const b of birthdays) {
      const list = map.get(b.day) ?? [];
      list.push(b);
      map.set(b.day, list);
    }
    return map;
  }, [birthdays]);

  // Por defecto, si se está mirando el mes real de hoy, arranca con el
  // día de hoy seleccionado (lo más probable que se quiera ver primero);
  // si es otro mes, arranca sin nada seleccionado.
  const [selectedDay, setSelectedDay] = useState<number | null>(() =>
    isSameMonth(viewedMonth, todayDate) ? todayDate.getDate() : null,
  );

  const gridStart = startOfWeek(startOfMonth(viewedMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(viewedMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekdayLabels = eachDayOfInterval({ start: gridStart, end: endOfWeek(gridStart, { weekStartsOn: 1 }) }).map(
    (d) => format(d, "EEEEEE", { locale: es }),
  );

  const selectedFollowUps = selectedDay ? (followUpsByDay.get(selectedDay) ?? []) : [];
  const selectedBirthdays = selectedDay ? (birthdaysByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink/50">
          {weekdayLabels.map((label, i) => (
            <div key={i} className="py-1 capitalize">
              {label}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = isSameMonth(day, viewedMonth);
            const dayNum = getDate(day);
            const dayFollowUps = inMonth ? (followUpsByDay.get(dayNum) ?? []) : [];
            const dayBirthdays = inMonth ? (birthdaysByDay.get(dayNum) ?? []) : [];
            const hasSomething = dayFollowUps.length > 0 || dayBirthdays.length > 0;
            const statusesPresent = [...new Set(dayFollowUps.map((f) => f.status))];
            const isSelected = inMonth && selectedDay === dayNum;

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={!inMonth}
                onClick={() => setSelectedDay(dayNum)}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center gap-1 rounded-lg py-1.5 text-sm transition-colors",
                  !inMonth && "text-ink/20",
                  inMonth && !isSelected && "text-ink hover:bg-panel/40",
                  isSelected && "bg-primary text-background",
                  isSameDay(day, todayDate) && !isSelected && "font-semibold text-primary",
                )}
              >
                <span>{dayNum}</span>
                {hasSomething && (
                  <span className="flex items-center gap-0.5">
                    {statusesPresent.map((status) => (
                      <span
                        key={status}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isSelected ? "bg-background" : STATUS_DOT[status],
                          // Ocultas por entrega pendiente se distinguen
                          // atenuando el punto, no con otro color — siguen
                          // siendo "pendiente", solo que a la espera.
                          status === "pendiente" &&
                            dayFollowUps.some((f) => f.hiddenByDelivery) &&
                            !isSelected &&
                            "opacity-40",
                        )}
                      />
                    ))}
                    {dayBirthdays.length > 0 && <span className="text-[10px] leading-none">🎂</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card>
          <p className="mb-3 font-display text-base text-ink">
            {format(new Date(year, month - 1, selectedDay), "EEEE d 'de' MMMM", { locale: es })}
          </p>

          {selectedFollowUps.length === 0 && selectedBirthdays.length === 0 ? (
            <p className="text-sm text-ink/50">No hay nada para este día.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedBirthdays.map((b) => (
                <div
                  key={`bday-${b.customerId}`}
                  className="flex items-center gap-2 rounded-xl border border-gold/20 bg-panel/30 p-3 text-sm"
                >
                  <span className="text-base">🎂</span>
                  <span className="text-ink">Cumpleaños de {b.customerName}</span>
                </div>
              ))}

              {selectedFollowUps.map((f) => (
                <FollowUpDetailCard key={f.id} entry={f} />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FollowUpDetailCard({ entry }: { entry: CalendarFollowUpEntry }) {
  const [message, setMessage] = useState(entry.messagePreview);
  const canMessage = entry.status === "pendiente" && !entry.hiddenByDelivery;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gold/20 bg-surface p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-ink">{entry.contactName}</p>
          {entry.isProspect && (
            <Badge variant="accent" className="gap-1">
              <UserPlus className="h-3 w-3" /> Prospecto
            </Badge>
          )}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            entry.status === "pendiente" && !entry.hiddenByDelivery && "bg-gold/25 text-ink",
            entry.status === "pendiente" && entry.hiddenByDelivery && "bg-ink/10 text-ink/60",
            entry.status === "hecho" && "bg-sage/25 text-ink",
            entry.status === "omitido" && "bg-ink/10 text-ink/50",
          )}
        >
          {entry.hiddenByDelivery ? "Esperando entrega" : STATUS_LABEL[entry.status]}
        </span>
      </div>

      {canMessage ? (
        <>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="text-xs" />
          {!entry.contactPhone && (
            <p className="text-[11px] text-ink/50">Sin teléfono — no se puede abrir WhatsApp.</p>
          )}
          <WhatsAppButton phone={entry.contactPhone} message={message} />
        </>
      ) : (
        <p className="text-xs text-ink/60">
          {entry.hiddenByDelivery
            ? "Todavía no se entregó lo que compró — la tarea va a aparecer en \"Hoy toca contactar\" apenas se entregue."
            : entry.messagePreview}
        </p>
      )}
    </div>
  );
}
