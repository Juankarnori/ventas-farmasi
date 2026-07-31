import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type SessionProfile = Database["public"]["Tables"]["profiles"]["Row"];

// Punto único usado por (app)/layout.tsx para exigir sesión + perfil
// reclamado en cada página autenticada. Sin sesión -> /auth/login.
// Con sesión pero sin perfil reclamado (no debería pasar salvo carrera
// entre pestañas) -> /auth/claim, que a su vez resuelve si el slot
// libre ya no existe.
export async function getSessionProfile(): Promise<SessionProfile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/auth/claim");
  }

  return profile;
}
