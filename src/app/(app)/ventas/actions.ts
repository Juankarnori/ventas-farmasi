"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";

export async function createSale(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const saleDate = String(formData.get("sale_date") ?? "");
  const customerName = String(formData.get("customer_name") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");

  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Los productos de la venta no son válidos");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Agregá al menos un producto a la venta");
  }

  const { error } = await supabase.rpc("create_sale", {
    p_customer_name: customerName,
    p_sale_date: saleDate,
    p_items: items,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  redirect("/ventas");
}

export async function createApartado(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const saleDate = String(formData.get("sale_date") ?? "");
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");

  if (!customerName) {
    throw new Error("El apartado necesita el nombre de la clienta");
  }

  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Los productos del apartado no son válidos");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Agregá al menos un producto al apartado");
  }

  const { data: saleId, error } = await supabase.rpc("create_apartado", {
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_sale_date: saleDate,
    p_items: items,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/ventas");
  revalidatePath("/ventas/apartados");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  redirect(`/ventas/apartados/${saleId}`);
}

export async function registerPayment(saleId: string, formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const amount = Number(formData.get("amount"));
  const paymentDate = String(formData.get("payment_date") ?? "");
  const method = String(formData.get("method") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El monto del abono tiene que ser mayor a 0");
  }

  const { error } = await supabase.rpc("register_payment", {
    p_sale_id: saleId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_method: method,
    p_note: note,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/ventas/apartados/${saleId}`);
  revalidatePath("/ventas/apartados");
  revalidatePath("/ventas");
  revalidatePath("/finanzas");
}

export async function markItemDelivered(saleId: string, saleItemId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_item_delivered", { p_sale_item_id: saleItemId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/ventas/apartados/${saleId}`);
  revalidatePath("/ventas/apartados");
  revalidatePath("/finanzas");
}

export async function cancelApartado(saleId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_apartado", { p_sale_id: saleId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/ventas/apartados");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  redirect("/ventas/apartados");
}
