"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";

export async function createOrder(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const orderDate = String(formData.get("order_date") ?? "");
  const itemsRaw = String(formData.get("items") ?? "[]");

  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Los productos del pedido no son válidos");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Agregá al menos un producto al pedido");
  }

  const { data: orderId, error } = await supabase.rpc("create_order", {
    p_order_date: orderDate,
    p_items: items,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/pedidos");
  redirect(`/pedidos/${orderId}`);
}

export async function markOrderReceived(orderId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_order_received", { p_order_id: orderId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/pedidos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  revalidatePath(`/pedidos/${orderId}`);
}
