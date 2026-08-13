import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "d MMM yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: es });
}

// El negocio opera en Ecuador (UTC-5, sin horario de verano — el offset
// es siempre el mismo, no hace falta una librería de timezones para
// esto). Se usa explícitamente en vez de confiar en la hora "local" del
// servidor: Vercel corre en UTC, así que calcular "hoy" con
// `new Date()` directo se corre un día adelantado durante toda la
// tarde/noche en Ecuador (a las 7pm en Quito ya es "mañana" en UTC) —
// esto era la causa real del bug de "la fecha aparece un día
// adelantada" en Pedidos/Ventas.
const ECUADOR_TIMEZONE = "America/Guayaquil";
const ECUADOR_UTC_OFFSET_MINUTES = -5 * 60;

export function todayISO() {
  // Intl.DateTimeFormat con locale "en-CA" formatea como YYYY-MM-DD
  // directo — no hay que armar el string a mano.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Convierte el valor crudo de un <input type="datetime-local"> (ej.
// "2026-08-12T14:30", sin timezone) al instante UTC real que representa
// en la hora de Ecuador — nunca se debe pasar ese string directo a `new
// Date(...)`: sin offset explícito, el motor de JS lo interpreta como
// hora LOCAL DEL SERVIDOR (Vercel = UTC), no la de quien lo tipeó, lo que
// corría la cita ~5 horas de la hora real elegida.
export function ecuadorDatetimeLocalToUTC(value: string): Date {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - ECUADOR_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMillis);
}

// "15 de marzo" — a propósito sin año: acá solo importa el día del
// cumpleaños, no cuántos cumple (ni siquiera lo sabemos con certeza si
// birth_date se cargó como aproximación).
export function formatBirthday(date: string) {
  return formatDate(date, "d 'de' MMMM");
}

// Edad actual a partir de la fecha de nacimiento — a diferencia de
// formatBirthday, acá sí importa el año completo. Resta 1 si todavía no
// pasó el cumpleaños de este año.
export function calculateAge(birthDate: string): number {
  const birth = parseISO(birthDate);
  // Mismo motivo que todayISO(): "hoy" tiene que ser el de Ecuador, no el
  // del servidor — sin esto, la edad podía adelantarse/atrasarse un día
  // justo alrededor del cumpleaños según la hora en que se mirara.
  const today = parseISO(todayISO());
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
