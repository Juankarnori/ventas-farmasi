import type { ProfileColor } from "@/lib/types/database.types";

// Lista corta de colores de identidad para perfiles, tomados de la
// paleta "Betty — Lavanda Malva Nude" de la app — así cualquier color que
// se elija sigue siendo consistente con la identidad visual, no colores
// sueltos. Cada par bg/text da al menos 4.5:1 de contraste real (los
// tonos "aclarados" existen solo para esto — ver globals.css):
//   teal  (#733865 sólido, ciruela) + texto claro -> ~7.3:1
//   coral (#D6B6C5 rosa empolvado)  + texto --ink  -> ~6.5:1
//   gold  (#C8A6C3 lavanda suave)   + texto --ink  -> ~5.6:1
//   sage  (#C29ABF malva aclarado)  + texto --ink  -> ~5.0:1
// (Los nombres de clave — teal/coral/gold/sage — quedaron de la paleta
// anterior; son solo identificadores internos guardados en
// profiles.color, no describen el tono actual. Cambiarlos requeriría una
// migración de datos que no aporta nada visual.)
export const IDENTITY_COLORS: Record<ProfileColor, { label: string; bgClass: string; textClass: string }> = {
  teal: { label: "Ciruela", bgClass: "bg-primary", textClass: "text-background" },
  coral: { label: "Rosa", bgClass: "bg-accent-pill", textClass: "text-ink" },
  gold: { label: "Lavanda", bgClass: "bg-gold", textClass: "text-ink" },
  sage: { label: "Malva", bgClass: "bg-sage-pill", textClass: "text-ink" },
};

export const IDENTITY_COLOR_KEYS = Object.keys(IDENTITY_COLORS) as ProfileColor[];
