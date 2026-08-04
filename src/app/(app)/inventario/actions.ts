"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";

// Se llama directamente desde el StockStepper (no como form action) para
// que el componente pueda envolverla en try/catch y mostrar el error
// inline junto al selector +/- — nunca dejar que un ajuste inválido tire
// a la pantalla genérica de error de Next.js.
export async function adjustStock(variantId: string, delta: number) {
  await getSessionProfile();
  const supabase = await createClient();

  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("Ingresá una cantidad distinta de 0");
  }

  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_note: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/inventario");
  revalidatePath("/catalogo");
}
