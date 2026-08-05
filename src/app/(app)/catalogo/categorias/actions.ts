"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { categorySchema, lineSchema } from "@/lib/validations/product";

export async function createCategory(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { error } = await supabase.from("categories").insert(parsed.data);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/catalogo/categorias");
  revalidatePath("/catalogo");
}

export async function deleteCategory(categoryId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) {
    throw new Error(
      "No se pudo eliminar: alguna de sus líneas tiene productos asignados. Reasigná esos productos primero.",
    );
  }

  revalidatePath("/catalogo/categorias");
  revalidatePath("/catalogo");
}

export async function createLine(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const parsed = lineSchema.safeParse({
    category_id: formData.get("category_id"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { error } = await supabase.from("product_lines").insert(parsed.data);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una línea con ese nombre en esa categoría");
    }
    throw new Error(error.message);
  }

  revalidatePath("/catalogo/categorias");
  revalidatePath("/catalogo");
}

export async function updateLine(lineId: string, formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const parsed = lineSchema.safeParse({
    category_id: formData.get("category_id"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { error } = await supabase.from("product_lines").update(parsed.data).eq("id", lineId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe una línea con ese nombre en esa categoría");
    }
    throw new Error(error.message);
  }

  revalidatePath("/catalogo/categorias");
  revalidatePath("/catalogo");
}

export async function deleteLine(lineId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("product_lines").delete().eq("id", lineId);

  if (error) {
    throw new Error("No se pudo eliminar: hay productos asignados a esta línea.");
  }

  revalidatePath("/catalogo/categorias");
  revalidatePath("/catalogo");
}
