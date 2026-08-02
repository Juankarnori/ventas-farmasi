import { cn } from "@/lib/utils/cn";

type BadgeVariant = "sage" | "accent" | "gold" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  sage: "bg-sage/25 text-ink",
  accent: "bg-accent/50 text-ink",
  gold: "bg-gold/25 text-ink",
  neutral: "bg-panel/50 text-ink/70",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
