"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect("/auth/login?error=oauth");
  }

  redirect(data.url);
}

export async function createOwnProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const displayName = String(formData.get("display_name") ?? "").trim();
  const color = String(formData.get("color") ?? "");

  if (!displayName) {
    redirect("/auth/claim?error=1");
  }

  // create_own_profile valida autorización + color + que no tenga ya un
  // perfil, y marca el correo como 'activo' en el mismo paso atómico.
  const { error } = await supabase.rpc("create_own_profile", {
    p_display_name: displayName,
    p_color: color,
  });

  if (error) {
    redirect("/auth/claim?error=1");
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
