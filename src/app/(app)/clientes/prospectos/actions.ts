"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { prospectSchema, prospectAppointmentSchema, type ProspectInput } from "@/lib/validations/prospect";

// Todas las acciones de este archivo devuelven { error? } en vez de tirar
// una excepción — en producción, Next.js oculta el mensaje real de
// cualquier throw no atrapado en una Server Action y lo reemplaza por un
// texto genérico + digest.

function parseProspectForm(
  formData: FormData,
): { ok: true; data: ProspectInput } | { ok: false; error: string } {
  const parsed = prospectSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    type: formData.get("type"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  return { ok: true, data: parsed.data };
}

export async function createProspect(formData: FormData): Promise<{ error?: string }> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const parsed = parseProspectForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase.from("prospects").insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    type: parsed.data.type,
    note: parsed.data.note || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/clientes/prospectos");
  return {};
}

export async function updateProspect(prospectId: string, formData: FormData): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const parsed = parseProspectForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { error } = await supabase
    .from("prospects")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      type: parsed.data.type,
      note: parsed.data.note || null,
    })
    .eq("id", prospectId);

  if (error) return { error: error.message };

  revalidatePath("/clientes/prospectos");
  return {};
}

export async function discardProspect(prospectId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("prospects").update({ status: "descartado" }).eq("id", prospectId);

  if (error) return { error: error.message };

  revalidatePath("/clientes/prospectos");
  return {};
}

// Convierte el prospecto en clienta real: crea el registro en
// `customers` con el mismo nombre/teléfono y marca el prospecto como
// 'convertido'. Dos escrituras separadas (no una función security
// definer) porque las dos tablas ya son de lectura/escritura libre entre
// usuarias (RLS solo exige sesión reclamada, no hace falta elevar
// privilegios) — mismo criterio que el resto de las acciones de
// Clientes/Prospectos.
export async function convertProspectToCustomer(prospectId: string): Promise<{ error?: string }> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: prospect, error: fetchError } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", prospectId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!prospect) return { error: "Prospecto no encontrado" };

  const { error: insertError } = await supabase.from("customers").insert({
    name: prospect.name,
    phone: prospect.phone,
    created_by: profile.id,
  });

  if (insertError) return { error: insertError.message };

  const { error: updateError } = await supabase
    .from("prospects")
    .update({ status: "convertido" })
    .eq("id", prospectId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/clientes/prospectos");
  revalidatePath("/clientes");
  return {};
}

export async function createAppointment(prospectId: string, formData: FormData): Promise<{ error?: string }> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const parsed = prospectAppointmentSchema.safeParse({
    scheduled_at: formData.get("scheduled_at"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const scheduledAt = new Date(parsed.data.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: "Fecha y hora inválidas" };
  }

  const { error } = await supabase.from("prospect_appointments").insert({
    prospect_id: prospectId,
    scheduled_at: scheduledAt.toISOString(),
    note: parsed.data.note || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  // También marca al prospecto como "contactado" si todavía estaba
  // "pendiente" — agendar una cita ya es un primer contacto real. No
  // pisa 'convertido'/'descartado' si ya estaba en alguno de esos.
  await supabase.from("prospects").update({ status: "contactado" }).eq("id", prospectId).eq("status", "pendiente");

  revalidatePath("/clientes/prospectos");
  return {};
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "completada" | "cancelada",
): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("prospect_appointments")
    .update({ status })
    .eq("id", appointmentId);

  if (error) return { error: error.message };

  revalidatePath("/clientes/prospectos");
  return {};
}
