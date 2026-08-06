"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { authorizedEmailSchema } from "@/lib/validations/team";

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile.is_admin) {
    throw new Error("No autorizado");
  }
  return profile;
}

export async function addAuthorizedEmail(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = authorizedEmailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Correo inválido");
  }

  const { error } = await supabase.rpc("add_authorized_email", { p_email: parsed.data.email });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/equipo");
}

export async function revokeAuthorizedEmail(email: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("revoke_authorized_email", { p_email: email });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/equipo");
}
