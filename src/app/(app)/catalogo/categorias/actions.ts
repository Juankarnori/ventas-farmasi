"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { categorySchema } from "@/lib/validations/product";

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
    throw new Error(error.message);
  }

  revalidatePath("/catalogo/categorias");
  revalidatePath("/catalogo");
}
