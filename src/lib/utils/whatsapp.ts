// Arma el link de click-to-chat de WhatsApp (wa.me) a partir de un
// teléfono guardado con formato libre (espacios, guiones, paréntesis, con
// o sin "+", con o sin código de país). wa.me necesita el número en
// formato internacional sin ningún símbolo: solo dígitos.
//
// Reglas de normalización (en ese orden):
// 1. Si el teléfono ya viene con "+", se respeta tal cual (ya es
//    internacional) — se le sacan los símbolos pero no se le toca el
//    código de país.
// 2. Si no tiene "+" pero ya empieza con "593" y tiene el largo típico de
//    un celular ecuatoriano con código de país (593 + 9 dígitos = 12), se
//    asume que ya viene con el código de país incluido y tampoco se toca.
// 3. En cualquier otro caso se asume Ecuador: se saca el 0 inicial si lo
//    tiene (formato típico "09XXXXXXXX") y se antepone "593".
export function normalizePhoneForWhatsApp(rawPhone: string): string | null {
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasLeadingPlus) {
    return digits;
  }

  if (digits.startsWith("593") && digits.length === 12) {
    return digits;
  }

  const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
  return `593${withoutLeadingZero}`;
}

// `null`/vacío si no hay teléfono válido — así el que llama puede decidir
// no mostrar el botón en vez de mostrar un link roto. `message` es
// opcional: si se pasa, precarga el texto del chat (el usuario lo puede
// editar en WhatsApp antes de mandarlo — igual que sin mensaje, esto
// nunca envía nada solo).
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const number = normalizePhoneForWhatsApp(phone);
  if (!number) return null;
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
