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
