import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  category_id: z.string().uuid().optional().or(z.literal("")),
  sale_price: z.coerce.number().min(0, "No puede ser negativo"),
  cost_price: z.coerce.number().min(0, "No puede ser negativo"),
  description: z.string().trim().optional().or(z.literal("")),
  stock: z.coerce.number().int().min(0, "No puede ser negativo"),
  low_stock_threshold: z.coerce.number().int().min(0, "No puede ser negativo"),
  image_url: z.string().trim().optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Tiene que ser un color hex, ej: #5F8FB8"),
});

export type CategoryInput = z.infer<typeof categorySchema>;
