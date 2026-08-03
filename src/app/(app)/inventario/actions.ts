"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";

export async function adjustStock(variantId: string, formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const delta = Number(formData.get("delta"));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("Ingresá una cantidad distinta de 0");
  }

  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_note: note,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/inventario");
  revalidatePath("/catalogo");
}
