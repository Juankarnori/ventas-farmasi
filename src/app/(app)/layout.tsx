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
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col">
        <Topbar profile={profile} />
        <main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
