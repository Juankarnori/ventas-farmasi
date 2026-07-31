import type { ProfileColor } from "@/lib/types/database.types";

// Mapea el color fijo de cada perfil (guardado en la DB como
// 'turquoise' | 'coral') a las clases Tailwind de la paleta del proyecto.
export const PROFILE_COLOR_CLASSES: Record<
  ProfileColor,
  { bg: string; text: string; ring: string }
> = {
  turquoise: { bg: "bg-primary", text: "text-primary", ring: "ring-primary" },
  coral: { bg: "bg-accent", text: "text-accent", ring: "ring-accent" },
};
