import { IdentityPill } from "./identity-pill";
import type { SessionProfile } from "@/lib/auth/get-session-profile";

export function Topbar({ profile }: { profile: SessionProfile }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/15 bg-base/90 px-4 py-3 backdrop-blur-sm md:px-8">
      <span className="font-display text-lg text-primary md:hidden">Farmasi Bella</span>
      <div className="hidden md:block" />
      <IdentityPill displayName={profile.display_name} color={profile.color} />
    </header>
  );
}
