import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent" | "sage" | "gold";
}) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-panel/40 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "primary" && "text-primary",
              tone === "accent" && "text-accent",
              tone === "sage" && "text-sage",
              tone === "gold" && "text-gold",
            )}
            aria-hidden
          />
        )}
      </div>
      <p className="mt-2 font-mono text-2xl tabular-nums text-ink">{value}</p>
    </div>
  );
}
