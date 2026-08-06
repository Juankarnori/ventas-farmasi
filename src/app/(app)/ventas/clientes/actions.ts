"use server";

import { revalidatePath } from "next/cache";
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

  revalidatePath("/ventas/clientes");
  return { customer: data };
}

export async function updateCustomerNotes(customerId: string, formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase
    .from("customers")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", customerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/ventas/clientes/${customerId}`);
}

export async function updateCustomerContact(customerId: string, formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/ventas/clientes/${customerId}`);
  revalidatePath("/ventas/clientes");
}
