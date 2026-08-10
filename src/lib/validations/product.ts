import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  category_id: z.string().uuid().optional().or(z.literal("")),
  line_id: z.string().uuid().optional().or(z.literal("")),
  sale_price: z.coerce.number().min(0, "No puede ser negativo"),
  cost_price: z.coerce.number().min(0, "No puede ser negativo"),
  description: z.string().trim().optional().or(z.literal("")),
  low_stock_threshold: z.coerce.number().int().min(0, "No puede ser negativo"),
  image_url: z.string().trim().optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

// Cada producto tiene 1 o mas variantes de color; el stock, precio y
// costo se registran a nivel de variante (ver migración
// 0014_product_variants.sql). `id` viene presente solo al editar una
// variante ya existente — el cliente serializa el array completo a JSON
// en un input oculto, así que los campos ya llegan tipados (no strings
// de FormData sueltos).
export const productVariantSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  color_name: z.string().trim().min(1, "El color necesita un nombre"),
  color_hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Tiene que ser un color hex, ej: #733865")
    .nullable(),
  // Código corto (SKU) — opcional, para buscar más rápido que por nombre
  // completo a medida que el catálogo crece. Nunca obligatorio: no debe
  // trabar la carga de lo que ya existe mientras el catálogo es chico.
  sku: z.string().trim().nullable(),
  stock: z.coerce.number().int().min(0, "No puede ser negativo"),
  price_override: z.coerce.number().min(0, "No puede ser negativo").nullable(),
  cost_override: z.coerce.number().min(0, "No puede ser negativo").nullable(),
  image_url: z.string().trim().nullable(),
});

export const productVariantsSchema = z
  .array(productVariantSchema)
  .min(1, "Necesitás al menos una variante de color");

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Tiene que ser un color hex, ej: #733865"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const lineSchema = z.object({
  category_id: z.string().uuid("Elegí una categoría"),
  name: z.string().trim().min(2, "El nombre es muy corto"),
});

export type LineInput = z.infer<typeof lineSchema>;
