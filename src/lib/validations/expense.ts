import { z } from "zod";

export const expenseSchema = z.object({
  expense_date: z.string().min(1, "Elegí una fecha"),
  category: z.enum(["envio", "empaque", "publicidad", "otro"]),
  description: z.string().trim().optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "No puede ser negativo"),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
