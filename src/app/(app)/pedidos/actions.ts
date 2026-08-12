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

// Solo mientras el pedido está pendiente: todavía no se movió ni un
// número de stock, así que reemplazar sus renglones enteros (borrar +
// reinsertar) y recalcular el total es seguro — no hay stock_movements
// ni nada más que dependa de estos order_items puntuales.
//
// Devuelve { error? } en vez de tirar una excepción: en producción,
// Next.js oculta el mensaje real de cualquier throw no atrapado en una
// Server Action y lo reemplaza por un texto genérico + digest — un
// try/catch del lado del cliente ya no alcanza para mostrar el motivo
// real, hace falta que nunca se lance como excepción para empezar.
export async function updateOrder(orderId: string, formData: FormData): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    // También cae acá si el pedido existe pero es de otra usuaria (no
    // admin): la RLS de `orders` ya lo esconde, así que para quien llama
    // es indistinguible de "no existe" — el mensaje genérico es correcto.
    return { error: "Pedido no encontrado." };
  }

  if (order.status === "cancelado") {
    return { error: "Este pedido está cancelado — no se puede editar." };
  }

  if (order.status !== "pendiente") {
    return {
      error:
        "Este pedido ya fue recibido y afectó el stock — no se puede editar. Si faltó o sobró algo, hacé un ajuste manual desde Inventario.",
    };
  }

  const itemsRaw = String(formData.get("items") ?? "[]");

  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "Los productos del pedido no son válidos" };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: "El pedido necesita al menos un producto" };
  }

  const parsedItems = items as { variant_id: string; quantity: number; unit_cost: number }[];
  const variantIds = parsedItems.map((i) => i.variant_id);

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, product_id")
    .in("id", variantIds);

  const productIdByVariant = new Map((variants ?? []).map((v) => [v.id, v.product_id]));

  for (const item of parsedItems) {
    if (!productIdByVariant.has(item.variant_id)) {
      return { error: "Uno de los productos del pedido ya no existe en el catálogo" };
    }
    if (!(item.quantity > 0)) {
      return { error: "Las cantidades tienen que ser mayores a 0" };
    }
  }

  const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", orderId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  const { error: insertError } = await supabase.from("order_items").insert(
    parsedItems.map((item) => ({
      order_id: orderId,
      variant_id: item.variant_id,
      product_id: productIdByVariant.get(item.variant_id) as string,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    })),
  );

  if (insertError) {
    return { error: insertError.message };
  }

  const totalCost = parsedItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  const { error: updateError } = await supabase
    .from("orders")
    .update({ total_cost: totalCost })
    .eq("id", orderId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  return {};
}

export async function markOrderReceived(orderId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_order_received", { p_order_id: orderId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/pedidos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  revalidatePath(`/pedidos/${orderId}`);
  return {};
}

// Solo mientras está pendiente — ver cancel_order. Un pedido pendiente
// todavía no sumó nada de stock (eso pasa recién al marcarlo recibido),
// así que cancelarlo no revierte nada.
export async function cancelOrder(orderId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  return {};
}
