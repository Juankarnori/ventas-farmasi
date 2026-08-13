"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { prospectSchema, prospectAppointmentSchema, type ProspectInput } from "@/lib/validations/prospect";
import { ecuadorDatetimeLocalToUTC } from "@/lib/utils/date";

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
    first_contact_date: formData.get("first_contact_date"),
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

  const firstContactDate = parsed.data.first_contact_date || null;

  const { data: prospect, error } = await supabase
    .from("prospects")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      type: parsed.data.type,
      note: parsed.data.note || null,
      first_contact_date: firstContactDate,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Genera las tareas de las reglas 'despues_de_contacto' si ya se
  // cargó la fecha de primer contacto — no hace nada si vino vacía (ver
  // create_follow_up_tasks_for_prospect).
  await supabase.rpc("create_follow_up_tasks_for_prospect", {
    p_prospect_id: prospect.id,
    p_first_contact_date: firstContactDate,
  });

  revalidatePath("/clientes/prospectos");
  revalidatePath("/clientes");
  revalidatePath("/clientes/calendario");
  revalidatePath("/");
  return {};
}

export async function updateProspect(prospectId: string, formData: FormData): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const parsed = parseProspectForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const firstContactDate = parsed.data.first_contact_date || null;

  const { error } = await supabase
    .from("prospects")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      type: parsed.data.type,
      note: parsed.data.note || null,
      first_contact_date: firstContactDate,
    })
    .eq("id", prospectId);

  if (error) return { error: error.message };

  // Igual que en el alta: si ya hay first_contact_date, genera las
  // tareas que falten (el guard "not exists" de la función evita
  // duplicar si esto se llama de nuevo en una edición posterior).
  await supabase.rpc("create_follow_up_tasks_for_prospect", {
    p_prospect_id: prospectId,
    p_first_contact_date: firstContactDate,
  });

  revalidatePath("/clientes/prospectos");
  revalidatePath("/clientes");
  revalidatePath("/clientes/calendario");
  revalidatePath("/");
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

  // El <input type="datetime-local"> manda un string sin timezone (ej.
  // "2026-08-12T14:30") — `new Date(...)` directo lo interpretaría como
  // hora del SERVIDOR (Vercel = UTC), corriendo la cita ~5 horas de la
  // hora real que se eligió en Ecuador. Ver ecuadorDatetimeLocalToUTC.
  const scheduledAt = ecuadorDatetimeLocalToUTC(parsed.data.scheduled_at);
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
