"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { customerSchema, quickCustomerSchema } from "@/lib/validations/customer";

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

// Alta rápida desde el flujo de venta/apartado: solo nombre y teléfono,
// sin salir del formulario. Se llama directamente (no como form action)
// para poder usar el id devuelto al toque en el combobox.
export async function createCustomerQuick(
  name: string,
  phone: string,
): Promise<{ customer?: CustomerOption; error?: string }> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const parsed = quickCustomerSchema.safeParse({ name, phone });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      created_by: profile.id,
    })
    .select("id, name, phone")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes");
  return { customer: data };
}

// Alta completa desde /clientes/nuevo: nombre, teléfono, cumpleaños y
// notas de una — a diferencia del alta rápida, acá sí importa poder
// cargar todo de entrada (esta es la puerta de entrada "de verdad" al
// registro de clientas, no un atajo en medio de otro formulario).
export async function createCustomer(formData: FormData) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    birth_date: formData.get("birth_date"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      birth_date: parsed.data.birth_date || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

// Devuelve { error? } en vez de tirar una excepción: en producción,
// Next.js oculta el mensaje real de cualquier throw no atrapado en una
// Server Action y lo reemplaza por un texto genérico + digest — hace
// falta que nunca se lance como excepción para que el mensaje real le
// llegue al cliente.
export async function updateCustomerContact(
  customerId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    birth_date: formData.get("birth_date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      birth_date: parsed.data.birth_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/clientes/${customerId}`);
  revalidatePath("/clientes");
  return {};
}

// Borra la clienta si no tiene nada que perder (sin ventas ni
// seguimientos asociados) o la archiva si sí — ver delete_customer en
// 0027_loan_valuation_edit_and_more.sql. Se llama directamente (no como
// form action) para poder mostrar un mensaje distinto según qué pasó en
// vez de un simple redirect ciego.
export async function deleteCustomer(
  customerId: string,
): Promise<{ result?: "deleted" | "archived"; error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("delete_customer", { p_customer_id: customerId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${customerId}`);

  return { result: data === "archived" ? "archived" : "deleted" };
}

// Resuelve una tarea de "Hoy toca contactar": 'hecho' tras escribirle de
// verdad, 'omitido' si esta vez no correspondía.
export async function completeFollowUpTask(
  taskId: string,
  status: "hecho" | "omitido",
): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("complete_follow_up_task", {
    p_task_id: taskId,
    p_status: status,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes");
  return {};
}
