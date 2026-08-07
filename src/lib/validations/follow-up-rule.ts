import { z } from "zod";

// `days_after` solo es obligatorio (y tiene que ser positivo) para
// 'despues_de_venta' — para 'cumpleanos' no aplica (el "día" ya lo da la
// fecha de nacimiento). Mismo criterio que el check constraint de
// follow_up_rules en 0023_customer_follow_ups.sql.
export const followUpRuleSchema = z
  .object({
    name: z.string().trim().min(2, "El nombre es muy corto"),
    trigger_type: z.enum(["despues_de_venta", "cumpleanos"], {
      message: "Elegí cuándo se activa la regla",
    }),
    days_after: z.coerce.number().int().positive().optional(),
    message_template: z.string().trim().min(5, "Escribí el mensaje de la regla"),
  })
  .refine((data) => data.trigger_type !== "despues_de_venta" || data.days_after !== undefined, {
    message: "Indicá a los cuántos días se activa",
    path: ["days_after"],
  });

export type FollowUpRuleInput = z.infer<typeof followUpRuleSchema>;
