import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function InventarioTabs({ active }: { active: "stock" | "uso-personal" }) {
  const tabs = [
    { value: "stock" as const, label: "Stock", href: "/inventario" },
    { value: "uso-personal" as const, label: "Uso personal", href: "/inventario/uso-personal" },
  ];

  return (
    <div className="flex w-fit gap-1 rounded-full border border-gold/20 bg-panel/30 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.value ? "bg-primary text-background" : "text-ink/60 hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
