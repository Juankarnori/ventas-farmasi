import { z } from "zod";

export const authorizedEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un correo válido"),
});

export type AuthorizedEmailInput = z.infer<typeof authorizedEmailSchema>;
