import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function ClientesTabs({ active }: { active: "clientes" | "reglas" | "calendario" }) {
  const tabs = [
    { value: "clientes" as const, label: "Clientes", href: "/clientes" },
    { value: "reglas" as const, label: "Reglas de seguimiento", href: "/clientes/reglas" },
    { value: "calendario" as const, label: "Calendario", href: "/clientes/calendario" },
  ];

  return (
    // w-fit + max-w-full + overflow-x-auto: en pantallas anchas se ve
    // como una píldora compacta de siempre; en angostas (con 3 pestañas y
    // "Reglas de seguimiento" de por medio, ya no entra holgado a 375px)
    // el excedente se desplaza adentro de esta tira nomás, en vez de
    // cortarse contra el overflow-x: hidden global de la página.
    <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-gold/20 bg-panel/30 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.value ? "bg-primary text-background" : "text-ink/60 hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
