import { z } from "zod";

export const prospectSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  phone: z.string().trim().optional().or(z.literal("")),
  type: z.enum(["ingreso", "venta"], { message: "Elegí un tipo" }),
  note: z.string().trim().optional().or(z.literal("")),
});

export type ProspectInput = z.infer<typeof prospectSchema>;

export const prospectAppointmentSchema = z.object({
  // <input type="datetime-local"> manda "YYYY-MM-DDTHH:mm", sin zona —
  // se interpreta como hora local del navegador al convertirla a Date
  // más adelante (mismo criterio de "hora del negocio" que el resto de
  // la app, que no maneja usuarias en zonas horarias distintas).
  scheduled_at: z.string().trim().min(1, "Elegí fecha y hora"),
  note: z.string().trim().optional().or(z.literal("")),
});

export type ProspectAppointmentInput = z.infer<typeof prospectAppointmentSchema>;
