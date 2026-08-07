import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Corre una vez al día (Vercel Cron, ver vercel.json) y genera las
// follow_up_tasks de tipo 'cumpleanos' del día. Vercel Cron llama a esta
// ruta sin ninguna sesión de usuaria (no hay cookies, no hay auth.uid())
// — por eso NO reutiliza el patrón normal de "actor autenticado" del
// resto de la app. En cambio: 1) se autentica con un secreto compartido
// (CRON_SECRET) que Vercel manda solo en la llamada del cron; 2) el
// trabajo pesado lo hace `run_birthday_check()`, una función
// `security definer` en Postgres otorgada explícitamente al rol `anon`
// (ver 0023_customer_follow_ups.sql) — sigue sin existir ninguna
// service-role key en este proyecto, ni falta hace acá.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("run_birthday_check");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
