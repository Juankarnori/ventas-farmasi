import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();

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
          {children}
        </main>
        <MobileNav isAdmin={profile.is_admin} />
      </div>
    </div>
  );
}
