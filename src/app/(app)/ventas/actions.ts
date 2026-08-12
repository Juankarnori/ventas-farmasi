"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import type { PaymentMethod } from "@/lib/types/database.types";

function readPaymentMethod(formData: FormData): { method: PaymentMethod; bankNote: string | null } {
  const raw = String(formData.get("payment_method") ?? "efectivo");
  if (raw !== "efectivo" && raw !== "transferencia") {
    throw new Error("Método de pago inválido");
  }
  const bankNote = String(formData.get("bank_note") ?? "").trim() || null;
  // El `if` de arriba ya garantiza en runtime que `raw` es una de las dos
  // opciones válidas — la aserción es segura, TS no puede angostar
  // `string` a un literal solo con comparaciones `!==`.
  return { method: raw as PaymentMethod, bankNote };
}

export async function createSale(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const saleDate = String(formData.get("sale_date") ?? "");
  const customerName = String(formData.get("customer_name") ?? "").trim() || null;
  const customerId = String(formData.get("customer_id") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const { method, bankNote } = readPaymentMethod(formData);

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
    p_customer_id: customerId,
    p_payment_method: method,
    p_bank_note: bankNote,
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
  const customerId = String(formData.get("customer_id") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "[]");
  const { method, bankNote } = readPaymentMethod(formData);

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
    p_customer_id: customerId,
    p_payment_method: method,
    p_bank_note: bankNote,
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

// Edición completa (productos + método de pago) de una venta de contado
// ya registrada — el servidor rechaza esto si la venta es un apartado
// (ver update_sale_items en 0025_sale_payment_method_and_edit.sql).
//
// Devuelve { error? } en vez de tirar una excepción: en producción,
// Next.js oculta el mensaje real de cualquier throw no atrapado en una
// Server Action y lo reemplaza por un texto genérico + digest — un
// try/catch del lado del cliente ya no alcanza para mostrar el motivo
// real, hace falta que nunca se lance como excepción para empezar. Todo
// el cuerpo queda envuelto en un try/catch propio (en vez de convertir
// cada `throw` suelto uno por uno) para no arriesgar reescribir mal
// alguna validación en el camino.
export async function updateSaleItems(saleId: string, formData: FormData): Promise<{ error?: string }> {
  try {
    await getSessionProfile();
    const supabase = await createClient();

    const itemsRaw = String(formData.get("items") ?? "[]");
    const { method, bankNote } = readPaymentMethod(formData);

    let items: unknown;
    try {
      items = JSON.parse(itemsRaw);
    } catch {
      throw new Error("Los productos de la venta no son válidos");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("La venta necesita al menos un producto");
    }

    const { error } = await supabase.rpc("update_sale_items", {
      p_sale_id: saleId,
      p_items: items,
      p_payment_method: method,
      p_bank_note: bankNote,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/ventas/${saleId}`);
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/catalogo");
    revalidatePath("/finanzas");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la venta. Intentá de nuevo." };
  }
}

// Edición liviana de método de pago — la única que aplica a un apartado
// (no toca productos ni stock, así que no tiene las restricciones de
// update_sale_items).
export async function updateSalePaymentMethod(
  saleId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    await getSessionProfile();
    const supabase = await createClient();

    const { method, bankNote } = readPaymentMethod(formData);

    const { error } = await supabase.rpc("update_sale_payment_method", {
      p_sale_id: saleId,
      p_payment_method: method,
      p_bank_note: bankNote,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/ventas/${saleId}`);
    revalidatePath(`/ventas/apartados/${saleId}`);
    revalidatePath("/ventas");
    revalidatePath("/ventas/apartados");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el método de pago. Intentá de nuevo." };
  }
}

// Edición de productos/cantidades de un apartado ya registrado — a
// diferencia de updateSaleItems (solo ventas de contado), esta pasa por
// update_apartado_items, que además bloquea si el nuevo total queda por
// debajo de lo ya abonado (ver 0028_edit_apartado_items.sql) — ese es
// justo el caso donde más importa que el mensaje real le llegue a quien
// está editando, no un texto genérico.
export async function updateApartadoItems(saleId: string, formData: FormData): Promise<{ error?: string }> {
  try {
    await getSessionProfile();
    const supabase = await createClient();

    const itemsRaw = String(formData.get("items") ?? "[]");

    let items: unknown;
    try {
      items = JSON.parse(itemsRaw);
    } catch {
      throw new Error("Los productos del apartado no son válidos");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("El apartado necesita al menos un producto");
    }

    const { error } = await supabase.rpc("update_apartado_items", {
      p_sale_id: saleId,
      p_items: items,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/ventas/apartados/${saleId}`);
    revalidatePath("/ventas/apartados");
    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/catalogo");
    revalidatePath("/finanzas");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el apartado. Intentá de nuevo." };
  }
}

// Edición liviana del nombre/teléfono de la clienta cargados en el propio
// apartado (por si se cargaron mal) — no toca stock ni plata, así que es
// un update directo a la tabla en vez de pasar por una función: la RLS de
// `sales` (vendedora dueña o admin) ya cubre la autorización.
export async function updateApartadoCustomer(
  saleId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    await getSessionProfile();
    const supabase = await createClient();

    const customerName = String(formData.get("customer_name") ?? "").trim();
    const customerPhone = String(formData.get("customer_phone") ?? "").trim() || null;

    if (!customerName) {
      throw new Error("El apartado necesita el nombre de la clienta");
    }

    const { error } = await supabase
      .from("sales")
      .update({ customer_name: customerName, customer_phone: customerPhone })
      .eq("id", saleId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/ventas/apartados/${saleId}`);
    revalidatePath("/ventas/apartados");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar. Intentá de nuevo." };
  }
}

export async function registerPayment(saleId: string, formData: FormData): Promise<{ error?: string }> {
  try {
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
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo registrar el abono. Intentá de nuevo." };
  }
}

export async function markItemDelivered(
  saleId: string,
  saleItemId: string,
): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_item_delivered", { p_sale_item_id: saleItemId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/ventas/apartados/${saleId}`);
  revalidatePath("/ventas/apartados");
  revalidatePath("/finanzas");
  // Si esta era la última entrega pendiente de la venta, la tarea de
  // seguimiento post-venta (si ya venció) tiene que aparecer en "Hoy toca
  // contactar" de inmediato — esa vista vive en Clientes y en Inicio.
  revalidatePath("/clientes");
  revalidatePath("/");
  return {};
}

// A diferencia de las demás acciones de este archivo, cancelApartado
// redirige al éxito — por eso NO se envuelve todo el cuerpo en un
// try/catch genérico (redirect() funciona lanzando una excepción especial
// que Next.js reconoce; un catch genérico la interceptaría por error y la
// convertiría en un { error } cualquiera en vez de dejarla navegar). Solo
// se convierte el chequeo de error puntual.
export async function cancelApartado(saleId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_apartado", { p_sale_id: saleId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/ventas/apartados");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  redirect("/ventas/apartados");
}

// Elimina una venta ya registrada (de contado o apartado) por completo —
// revierte el stock, borra las follow_up_tasks que haya generado, y la
// venta (con sale_items/sale_payments en cascada). Se llama directo
// desde la tarjeta en el listado (no una página de detalle), así que acá
// no redirige — solo revalida para que la tarjeta desaparezca con datos
// frescos.
export async function deleteSale(saleId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_sale", { p_sale_id: saleId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/ventas");
  revalidatePath("/ventas/apartados");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  revalidatePath("/clientes");
  revalidatePath("/finanzas");
  revalidatePath("/");
  return {};
}
