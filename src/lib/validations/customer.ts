import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  phone: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  // Opcional a propósito: no siempre se sabe la fecha de nacimiento de
  // una clienta. Vacío se guarda como null, nunca como fecha inválida.
  birth_date: z.string().trim().optional().or(z.literal("")),
});

export type CustomerInput = z.infer<typeof customerSchema>;

// Para el alta rápida desde el flujo de venta: solo nombre y teléfono,
// sin notas ni cumpleaños (esos se completan después desde la ficha si
// se quiere).
export const quickCustomerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  phone: z.string().trim().optional().or(z.literal("")),
});

export type QuickCustomerInput = z.infer<typeof quickCustomerSchema>;
