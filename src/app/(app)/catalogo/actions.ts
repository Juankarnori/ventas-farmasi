"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { productSchema, productVariantsSchema } from "@/lib/validations/product";

function parseProductForm(formData: FormData) {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    sale_price: formData.get("sale_price"),
    cost_price: formData.get("cost_price"),
    description: formData.get("description"),
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
    low_stock_threshold: parsed.data.low_stock_threshold,
    image_url: parsed.data.image_url || null,
  };
}

function parseVariantsForm(formData: FormData) {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("variants") ?? "[]"));
  } catch {
    throw new Error("Las variantes de color no son válidas");
  }

  const parsed = productVariantsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Variantes inválidas");
  }

  return parsed.data;
}

export async function createProduct(formData: FormData) {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const values = parseProductForm(formData);
  const variants = parseVariantsForm(formData);

  const { data: product, error } = await supabase
    .from("products")
    .insert({ ...values, created_by: profile.id })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // El stock ahora es por usuaria (variant_stock): el que se carga acá
  // en el formulario queda a nombre de quien está creando el producto.
  for (const v of variants) {
    const { data: variant, error: variantError } = await supabase
      .from("product_variants")
      .insert({
        product_id: product.id,
        color_name: v.color_name,
        color_hex: v.color_hex,
        price_override: v.price_override,
        cost_override: v.cost_override,
        image_url: v.image_url,
      })
      .select("id")
      .single();

    if (variantError) {
      throw new Error(variantError.message);
    }

    if (v.stock > 0) {
      const { error: stockError } = await supabase
        .from("variant_stock")
        .insert({ variant_id: variant.id, profile_id: profile.id, stock: v.stock });

      if (stockError) {
        throw new Error(stockError.message);
      }
    }
  }

  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function updateProduct(productId: string, formData: FormData) {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const values = parseProductForm(formData);
  const variants = parseVariantsForm(formData);

  const { error } = await supabase.from("products").update(values).eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }

  const { data: existing } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  const existingIds = new Set((existing ?? []).map((v) => v.id));
  const submittedIds = new Set(variants.filter((v) => v.id).map((v) => v.id as string));

  const toUpdate = variants.filter((v) => v.id && existingIds.has(v.id));
  const toInsert = variants.filter((v) => !v.id);
  const toDeleteIds = [...existingIds].filter((id) => !submittedIds.has(id));

  // El stock del formulario es siempre "el mío": se guarda como
  // variant_stock de quien está editando, nunca pisa el de la otra
  // usuaria (esa fila ni se toca acá).
  for (const v of toUpdate) {
    const { error: updateError } = await supabase
      .from("product_variants")
      .update({
        color_name: v.color_name,
        color_hex: v.color_hex,
        price_override: v.price_override,
        cost_override: v.cost_override,
        image_url: v.image_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", v.id as string);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: stockError } = await supabase
      .from("variant_stock")
      .upsert(
        { variant_id: v.id as string, profile_id: profile.id, stock: v.stock },
        { onConflict: "variant_id,profile_id" },
      );

    if (stockError) {
      throw new Error(stockError.message);
    }
  }

  for (const v of toInsert) {
    const { data: variant, error: insertError } = await supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        color_name: v.color_name,
        color_hex: v.color_hex,
        price_override: v.price_override,
        cost_override: v.cost_override,
        image_url: v.image_url,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    if (v.stock > 0) {
      const { error: stockError } = await supabase
        .from("variant_stock")
        .insert({ variant_id: variant.id, profile_id: profile.id, stock: v.stock });

      if (stockError) {
        throw new Error(stockError.message);
      }
    }
  }

  if (toDeleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .in("id", toDeleteIds);

    if (deleteError) {
      throw new Error(
        "No se pudo quitar una variante que ya tiene ventas, pedidos o préstamos registrados.",
      );
    }
  }

  revalidatePath("/catalogo");
  redirect("/catalogo");
}

export async function deleteProduct(productId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    throw new Error(
      "No se pudo eliminar: alguna de sus variantes tiene ventas, pedidos o préstamos registrados.",
    );
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

export async function listProductImages(): Promise<{ name: string; url: string }[]> {
  await getSessionProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from("product-images").list("", {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data) return [];

  return data
    .filter((file) => file.id)
    .map((file) => {
      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(file.name);
      return { name: file.name, url: publicUrl };
    });
}
