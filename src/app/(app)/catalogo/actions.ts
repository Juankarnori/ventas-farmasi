"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { productSchema } from "@/lib/validations/product";

function parseProductForm(formData: FormData) {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    sale_price: formData.get("sale_price"),
    cost_price: formData.get("cost_price"),
    description: formData.get("description"),
    stock: formData.get("stock"),
    low_stock_threshold: formData.get("low_stock_threshold"),
    image_url: formData.get("image_url"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  return {
    name: parsed.data.name,
    category_id: parsed.data.category_id || null,
    sale_price: parsed.data.sale_price,
    cost_price: parsed.data.cost_price,
    description: parsed.data.description || null,
    stock: parsed.data.stock,
    low_stock_threshold: parsed.data.low_stock_threshold,
    image_url: parsed.data.image_url || null,
  };
}

export async function createProduct(formData: FormData) {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const values = parseProductForm(formData);

  const { error } = await supabase
    .from("products")
    .insert({ ...values, created_by: profile.id });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function updateProduct(productId: string, formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();
  const values = parseProductForm(formData);

  const { error } = await supabase.from("products").update(values).eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function deleteProduct(productId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/catalogo");
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function uploadProductImage(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí una imagen" };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Formato no soportado (usá png, jpg, webp o gif)" };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "La imagen pesa más de 5MB" };
  }

  const extension = file.type.split("/")[1];
  const path = `${randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from("product-images").upload(path, file);

  if (error) {
    return { error: error.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);

  return { url: publicUrl };
}
