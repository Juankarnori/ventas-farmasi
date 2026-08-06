"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getNavItems } from "./nav-items";

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = getNavItems(isAdmin);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around overflow-x-auto border-t border-gold/20 bg-base/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-[64px] flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
              active ? "text-primary" : "text-ink/50",
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
