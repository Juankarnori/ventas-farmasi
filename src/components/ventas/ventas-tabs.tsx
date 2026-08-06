import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function VentasTabs({ active }: { active: "ventas" | "apartados" | "clientes" }) {
  const tabs = [
    { value: "ventas" as const, label: "Ventas", href: "/ventas" },
    { value: "apartados" as const, label: "Apartados", href: "/ventas/apartados" },
    { value: "clientes" as const, label: "Clientes", href: "/ventas/clientes" },
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
