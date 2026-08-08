"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { todayISO } from "@/lib/utils/date";

// Se llama directamente desde el StockStepper (no como form action) para
// que el componente pueda mostrar el error inline junto al selector +/-.
// Devuelve el error en vez de tirarlo (`throw`) a propósito: en
// producción, Next.js oculta el mensaje real de cualquier excepción no
// atrapada que salga de una Server Action y lo reemplaza por un texto
// genérico + digest — un try/catch del lado del cliente ya no alcanza
// para mostrar el motivo real, hace falta que nunca se lance como
// excepción para empezar.
export async function adjustStock(variantId: string, delta: number): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  if (!Number.isFinite(delta) || delta === 0) {
    return { error: "Ingresá una cantidad distinta de 0" };
  }

  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_note: null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  return {};
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
