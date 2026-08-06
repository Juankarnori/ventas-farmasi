import type { ProfileColor } from "@/lib/types/database.types";

// Lista corta de colores de identidad para perfiles, tomados de la
// paleta "Teal & gold profundo" de la app — así cualquier color que se
// elija sigue siendo consistente con la identidad visual, no colores
// sueltos. Cada par bg/text da al menos 4.5:1 de contraste real (los
// tonos "aclarados" existen solo para esto — ver globals.css):
//   teal  (#0E5C52 sólido)    + texto claro -> ~7.7:1
//   coral (#E19279 aclarado)  + texto --ink -> ~4.8:1
//   gold  (#C9A15A sólido)    + texto --ink -> ~4.9:1
//   sage  (#83AFA7 aclarado)  + texto --ink -> ~4.85:1
export const IDENTITY_COLORS: Record<ProfileColor, { label: string; bgClass: string; textClass: string }> = {
  teal: { label: "Teal", bgClass: "bg-primary", textClass: "text-background" },
  coral: { label: "Coral", bgClass: "bg-accent-pill", textClass: "text-ink" },
  gold: { label: "Dorado", bgClass: "bg-gold", textClass: "text-ink" },
  sage: { label: "Sage", bgClass: "bg-sage-pill", textClass: "text-ink" },
};

export const IDENTITY_COLOR_KEYS = Object.keys(IDENTITY_COLORS) as ProfileColor[];
