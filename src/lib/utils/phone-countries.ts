// Países disponibles en el selector de teléfono de Clientes — mercado
// principal (Ecuador) primero porque queda preseleccionado por defecto,
// el resto en el orden en que un vendedor Farmasi de la región
// probablemente los necesite.
export interface PhoneCountry {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "EC", dialCode: "593", flag: "🇪🇨", name: "Ecuador" },
  { code: "CO", dialCode: "57", flag: "🇨🇴", name: "Colombia" },
  { code: "PE", dialCode: "51", flag: "🇵🇪", name: "Perú" },
  { code: "MX", dialCode: "52", flag: "🇲🇽", name: "México" },
  { code: "CL", dialCode: "56", flag: "🇨🇱", name: "Chile" },
  { code: "AR", dialCode: "54", flag: "🇦🇷", name: "Argentina" },
  { code: "VE", dialCode: "58", flag: "🇻🇪", name: "Venezuela" },
  { code: "BO", dialCode: "591", flag: "🇧🇴", name: "Bolivia" },
  { code: "PY", dialCode: "595", flag: "🇵🇾", name: "Paraguay" },
  { code: "UY", dialCode: "598", flag: "🇺🇾", name: "Uruguay" },
  { code: "PA", dialCode: "507", flag: "🇵🇦", name: "Panamá" },
  { code: "GT", dialCode: "502", flag: "🇬🇹", name: "Guatemala" },
  { code: "CR", dialCode: "506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "ES", dialCode: "34", flag: "🇪🇸", name: "España" },
  { code: "US", dialCode: "1", flag: "🇺🇸", name: "Estados Unidos" },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]; // Ecuador

// Códigos ordenados de más largo a más corto — necesario para no
// matchear de forma ambigua un prefijo corto (ej. "1") antes que uno
// largo que también empiece con el mismo dígito (ej. "51", "593").
const DIAL_CODES_BY_LENGTH = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

// A partir de un teléfono ya guardado (o vacío, para un cliente nuevo),
// separa país + número local para precargar el selector. Mismo criterio
// de compatibilidad que normalizePhoneForWhatsApp (ver whatsapp.ts): si
// no tiene "+", se asume que es un número viejo cargado como Ecuador
// (con o sin el 0 inicial típico), nunca se inventa un país que no está
// guardado.
export function parsePhoneWithCountry(rawPhone: string): { dialCode: string; local: string } {
  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return { dialCode: DEFAULT_PHONE_COUNTRY.dialCode, local: "" };
  }

  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    const match = DIAL_CODES_BY_LENGTH.find((c) => digits.startsWith(c.dialCode));
    if (match) {
      return { dialCode: match.dialCode, local: digits.slice(match.dialCode.length) };
    }
    // Tiene "+" pero con un código que no está en la lista — se deja tal
    // cual en el campo de número en vez de perder el dato.
    return { dialCode: DEFAULT_PHONE_COUNTRY.dialCode, local: digits };
  }

  // Sin "+": número viejo, guardado asumiendo Ecuador — mismo ajuste del
  // 0 inicial que ya hace normalizePhoneForWhatsApp.
  const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
  return { dialCode: DEFAULT_PHONE_COUNTRY.dialCode, local: withoutLeadingZero };
}
