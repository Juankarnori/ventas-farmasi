"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { followUpRuleSchema } from "@/lib/validations/follow-up-rule";

function parseRuleForm(formData: FormData) {
  const parsed = followUpRuleSchema.safeParse({
    name: formData.get("name"),
    trigger_type: formData.get("trigger_type"),
    days_after: formData.get("days_after") || undefined,
    message_template: formData.get("message_template"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  return parsed.data;
}

// Todas las acciones de este archivo devuelven { error? } en vez de tirar
// una excepción: en producción, Next.js oculta el mensaje real de
// cualquier throw no atrapado en una Server Action y lo reemplaza por un
// texto genérico + digest — un try/catch del lado del cliente ya no
// alcanza para mostrar el motivo real, hace falta que nunca se lance como
// excepción para empezar. Cada función queda envuelta en su propio
// try/catch en vez de convertir cada `throw` interno uno por uno.

export async function createFollowUpRule(formData: FormData): Promise<{ error?: string }> {
  try {
    const profile = await getSessionProfile();
    const supabase = await createClient();
    const data = parseRuleForm(formData);

    const { error } = await supabase.from("follow_up_rules").insert({
      name: data.name,
      trigger_type: data.trigger_type,
      // El check constraint de la tabla exige days_after null para
      // 'cumpleanos' — se fuerza acá para no depender de que el form
      // nunca mande un valor sobrante.
      days_after: data.trigger_type === "despues_de_venta" ? (data.days_after ?? null) : null,
      message_template: data.message_template,
      created_by: profile.id,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Mismo set de rutas que backfillFollowUpTasks/runBirthdayCheckManually
    // — una regla nueva puede generar tareas que se ven en cualquiera de
    // estas cuatro vistas, no solo en el listado de reglas.
    revalidatePath("/clientes/reglas");
    revalidatePath("/clientes");
    revalidatePath("/clientes/calendario");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la regla. Intentá de nuevo." };
  }
}

export async function updateFollowUpRule(ruleId: string, formData: FormData): Promise<{ error?: string }> {
  try {
    await getSessionProfile();
    const supabase = await createClient();
    const data = parseRuleForm(formData);

    const { error } = await supabase
      .from("follow_up_rules")
      .update({
        name: data.name,
        trigger_type: data.trigger_type,
        days_after: data.trigger_type === "despues_de_venta" ? (data.days_after ?? null) : null,
        message_template: data.message_template,
      })
      .eq("id", ruleId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/clientes/reglas");
    revalidatePath("/clientes");
    revalidatePath("/clientes/calendario");
    revalidatePath("/");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar la regla. Intentá de nuevo." };
  }
}

// Alternativa a borrar cuando la regla ya tiene historial (ver
// deleteFollowUpRule más abajo): se desactiva/reactiva sin perder a qué
// regla apuntan las tareas ya generadas por ella.
export async function setFollowUpRuleActive(ruleId: string, active: boolean): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("follow_up_rules").update({ active }).eq("id", ruleId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes/reglas");
  return {};
}

// Borra la regla si nunca generó ninguna tarea; si ya generó alguna
// (sin importar su estado), delete_follow_up_rule rechaza el borrado con
// un mensaje explicando por qué y sugiriendo desactivar en su lugar — ese
// mensaje se muestra tal cual, no se reformula acá.
export async function deleteFollowUpRule(ruleId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_follow_up_rule", { p_rule_id: ruleId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes/reglas");
  return {};
}

// Cuántas tareas generaría "Aplicar a ventas anteriores" para esta
// regla — se llama directamente (no como form action) para mostrar el
// número en el diálogo de confirmación antes de tocar nada.
export async function countBackfillFollowUpTasks(ruleId: string): Promise<{ count?: number; error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("count_backfill_follow_up_tasks", { p_rule_id: ruleId });

  if (error) {
    return { error: error.message };
  }

  return { count: data ?? 0 };
}

// Genera tareas de seguimiento para ventas que ya existían antes de que
// esta regla se creara/activara — no duplica si se aplica más de una vez
// (ver backfill_follow_up_tasks_for_rule). Devuelve cuántas se crearon
// para mostrar un mensaje de confirmación.
export async function backfillFollowUpTasks(ruleId: string): Promise<{ created?: number; error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("backfill_follow_up_tasks_for_rule", { p_rule_id: ruleId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/clientes/reglas");
  revalidatePath("/clientes/calendario");
  revalidatePath("/");

  return { created: data ?? 0 };
}

// Dispara a mano la revisión de cumpleaños (la misma lógica que corre
// sola todos los días por el cron de Vercel) — para probar una regla de
// tipo 'cumpleanos' sin tener que esperar al día siguiente.
export async function runBirthdayCheckManually(): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("run_birthday_check");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/clientes/reglas");
  revalidatePath("/clientes/calendario");
  revalidatePath("/");
  return {};
}
