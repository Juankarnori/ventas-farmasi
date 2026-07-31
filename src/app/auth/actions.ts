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

export async function claimProfile(profileId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // La RLS (profiles_claim_update) es la que realmente decide si esto
  // se permite: solo pisa filas con user_id null, solo con el propio
  // uid, y solo si ese uid no tiene ya otro perfil.
  const { error } = await supabase
    .from("profiles")
    .update({ user_id: user.id, claimed_at: new Date().toISOString() })
    .eq("id", profileId)
    .is("user_id", null);

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
