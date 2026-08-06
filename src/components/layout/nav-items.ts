import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  PackageCheck,
  Receipt,
  HandCoins,
  Users,
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

// Solo visible para perfiles con is_admin = true (ver AppLayout).
export const ADMIN_NAV_ITEM: NavItem = { href: "/equipo", label: "Equipo", icon: Users };

export function getNavItems(isAdmin: boolean): NavItem[] {
  return isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
}
