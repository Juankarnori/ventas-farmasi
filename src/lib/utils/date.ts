import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "d MMM yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: es });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// "15 de marzo" — a propósito sin año: acá solo importa el día del
// cumpleaños, no cuántos cumple (ni siquiera lo sabemos con certeza si
// birth_date se cargó como aproximación).
export function formatBirthday(date: string) {
  return formatDate(date, "d 'de' MMMM");
}
