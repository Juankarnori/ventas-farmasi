import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.email) {
        // El chequeo de autorización pasa ANTES que cualquier lógica de
        // perfil: si el correo no está en la lista (o fue revocado), se
        // corta acá — nunca se crea ni se toca ningún perfil para una
        // cuenta no autorizada.
        const { data: status } = await supabase.rpc("check_email_authorization", {
          p_email: user.email,
        });

        if (!status || status === "revocado") {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/auth/unauthorized?reason=not_authorized`);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          return NextResponse.redirect(`${origin}/`);
        }

        // Correo autorizado sin perfil todavía: primera vez que entra,
        // va a crear su nombre y color. Ya no hay "slots" que puedan
        // estar ocupados — cualquier cantidad de perfiles puede convivir.
        return NextResponse.redirect(`${origin}/auth/claim`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
