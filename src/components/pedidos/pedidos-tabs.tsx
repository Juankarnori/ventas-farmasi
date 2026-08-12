import Link from "next/link";
import { cn } from "@/lib/utils/cn";

// Mismo patrón que VentasTabs — "Comprar" vive como pestaña de Pedidos en
// vez de sección propia de nivel superior: es, en el fondo, una vista
// distinta de la misma idea ("qué le falta reponer al negocio"), no un
// concepto nuevo que amerite su propio ícono en el menú principal.
export function PedidosTabs({ active }: { active: "pedidos" | "comprar" }) {
  const tabs = [
    { value: "pedidos" as const, label: "Pedidos", href: "/pedidos" },
    { value: "comprar" as const, label: "Comprar", href: "/pedidos/comprar" },
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
