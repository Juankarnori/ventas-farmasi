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

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          return NextResponse.redirect(`${origin}/`);
        }

        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .is("user_id", null);

        if (count && count > 0) {
          return NextResponse.redirect(`${origin}/auth/claim`);
        }

        // Los 2 slots ya estan reclamados por otras cuentas: esta cuenta
        // de Google no es ninguna de las 2 usuarias autorizadas.
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth/unauthorized`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth`);
}
