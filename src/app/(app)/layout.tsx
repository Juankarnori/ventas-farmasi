import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import {
  AppointmentReminderBanner,
  type UpcomingAppointment,
} from "@/components/clientes/appointment-reminder-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  // Recordatorio de citas de Prospectos (ver AppointmentReminderBanner):
  // solo las propias (created_by = quien la agendó, mismo criterio que
  // hubiera usado el push), en una ventana amplia — el filtro fino de
  // "faltan 10 minutos" lo hace el componente cliente, recalculado cada
  // 20s mientras la página siga abierta.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const { data: appointments } = await supabase
    .from("prospect_appointments")
    .select("id, prospect_id, scheduled_at")
    .eq("created_by", profile.id)
    .eq("status", "pendiente")
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd)
    .order("scheduled_at", { ascending: true });

  const prospectIds = [...new Set((appointments ?? []).map((a) => a.prospect_id))];
  const { data: prospects } =
    prospectIds.length > 0
      ? await supabase.from("prospects").select("id, name").in("id", prospectIds)
      : { data: [] };
  const prospectNameById = new Map((prospects ?? []).map((p) => [p.id, p.name]));

  const upcomingAppointments: UpcomingAppointment[] = (appointments ?? []).map((a) => ({
    id: a.id,
    prospectId: a.prospect_id,
    prospectName: prospectNameById.get(a.prospect_id) ?? "—",
    scheduledAt: a.scheduled_at,
  }));

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-60 flex-col gap-8 border-r border-gold/15 bg-base p-6 md:flex">
        <span className="font-display text-xl text-primary">Farmasi Bella</span>
        <SidebarNav isAdmin={profile.is_admin} />
      </aside>

      {/*
        min-w-0: sin esto, este item de flex (fila con el <aside>) nunca
        se achica por debajo del ancho intrínseco de lo que haya adentro
        — es el default de flexbox, `min-width: auto`. Si algún hijo en
        cualquier página (un carrusel, una tabla ancha) tiene contenido
        de ancho fijo, esta columna entera se estira para no cortarlo, y
        eso empuja el body más ancho que el viewport — la barra de scroll
        horizontal aparece acá, no donde está el contenido que la causó.
      */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-20 pt-6 md:px-8 md:pb-8">
          <AppointmentReminderBanner appointments={upcomingAppointments} />
          {children}
        </main>
        <MobileNav isAdmin={profile.is_admin} />
      </div>
    </div>
  );
}
