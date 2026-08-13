import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { ClientesTabs } from "@/components/clientes/clientes-tabs";
import { FollowUpCalendar } from "@/components/clientes/follow-up-calendar";
import { getCalendarMonthData } from "@/lib/queries/calendar-follow-ups";
import { todayISO } from "@/lib/utils/date";

function clampMonth(year: number, month: number) {
  // Navegar de enero hacia atrás cae en diciembre del año anterior, y de
  // diciembre hacia adelante en enero del siguiente — igual que cualquier
  // calendario de mes a mes.
  if (month < 1) return { year: year - 1, month: 12 };
  if (month > 12) return { year: year + 1, month: 1 };
  return { year, month };
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  // Ecuador, no la del servidor (ver todayISO) — si no, el mes/día "de
  // hoy" por defecto se corre durante la tarde/noche.
  const [todayYear, todayMonth] = todayISO().split("-").map(Number);
  const year = Number(params.year) || todayYear;
  const month = Number(params.month) || todayMonth;

  const supabase = await createClient();
  const { followUps, birthdays } = await getCalendarMonthData(supabase, { year, month });

  const prev = clampMonth(year, month - 1);
  const next = clampMonth(year, month + 1);
  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Clientes</h1>
        <p className="mt-1 text-sm text-ink/60">
          Qué seguimientos y cumpleaños vienen este mes, de un vistazo.
        </p>
      </div>

      <ClientesTabs active="calendario" />

      <div className="flex items-center justify-center gap-4">
        <Link
          href={`/clientes/calendario?year=${prev.year}&month=${prev.month}`}
          aria-label="Mes anterior"
          className="rounded-full p-2 text-ink/50 hover:bg-panel/40 hover:text-ink"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="w-40 text-center font-display text-lg capitalize text-ink">{monthLabel}</h2>
        <Link
          href={`/clientes/calendario?year=${next.year}&month=${next.month}`}
          aria-label="Mes siguiente"
          className="rounded-full p-2 text-ink/50 hover:bg-panel/40 hover:text-ink"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* key fuerza a remontar al cambiar de mes — así "selectedDay" no
          arrastra el día seleccionado de un mes al siguiente y vuelve a
          calcular el default (hoy, si el mes visible es el actual). */}
      <FollowUpCalendar key={`${year}-${month}`} year={year} month={month} followUps={followUps} birthdays={birthdays} />
    </div>
  );
}
