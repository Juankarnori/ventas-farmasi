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

// Edad actual a partir de la fecha de nacimiento — a diferencia de
// formatBirthday, acá sí importa el año completo. Resta 1 si todavía no
// pasó el cumpleaños de este año.
export function calculateAge(birthDate: string): number {
  const birth = parseISO(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}
