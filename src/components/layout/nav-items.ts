import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  PackageCheck,
  Receipt,
  HandCoins,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/finanzas", label: "Finanzas", icon: LayoutDashboard },
  { href: "/catalogo", label: "Catálogo", icon: ShoppingBag },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/pedidos", label: "Pedidos", icon: PackageCheck },
  { href: "/ventas", label: "Ventas", icon: Receipt },
  { href: "/prestamos", label: "Préstamos", icon: HandCoins },
];
