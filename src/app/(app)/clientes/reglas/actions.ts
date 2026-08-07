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

export async function createFollowUpRule(formData: FormData) {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const data = parseRuleForm(formData);

  const { error } = await supabase.from("follow_up_rules").insert({
    name: data.name,
    trigger_type: data.trigger_type,
    // El check constraint de la tabla exige days_after null para
    // 'cumpleanos' — se fuerza acá para no depender de que el form nunca
    // mande un valor sobrante.
    days_after: data.trigger_type === "despues_de_venta" ? (data.days_after ?? null) : null,
    message_template: data.message_template,
    created_by: profile.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clientes/reglas");
}

export async function updateFollowUpRule(ruleId: string, formData: FormData) {
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
}

// No se borran (se perdería a qué regla apuntan las tareas ya generadas
// por ella) — se desactivan/reactivan.
export async function setFollowUpRuleActive(ruleId: string, active: boolean) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("follow_up_rules").update({ active }).eq("id", ruleId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clientes/reglas");
}

// Dispara a mano la revisión de cumpleaños (la misma lógica que corre
// sola todos los días por el cron de Vercel) — para probar una regla de
// tipo 'cumpleanos' sin tener que esperar al día siguiente.
export async function runBirthdayCheckManually() {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("run_birthday_check");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clientes");
  revalidatePath("/clientes/reglas");
}
