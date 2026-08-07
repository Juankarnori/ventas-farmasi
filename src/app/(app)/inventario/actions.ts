"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { todayISO } from "@/lib/utils/date";

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

// Uso personal: descuenta stock propio sin pasar por Ventas ni por
// Finanzas — es consumo, no una venta con precio $0 (eso sí ensuciaría el
// historial y las métricas). Ver register_personal_use en
// 0026_personal_use_and_balances.sql.
export async function registerPersonalUse(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const variantId = String(formData.get("variant_id") ?? "");
  const quantity = Number(formData.get("quantity"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const usedAt = String(formData.get("used_at") ?? "").trim() || todayISO();

  if (!variantId) {
    throw new Error("Elegí un producto");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("La cantidad tiene que ser mayor a 0");
  }

  const { error } = await supabase.rpc("register_personal_use", {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_note: note,
    p_used_at: usedAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/inventario/uso-personal");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
}
