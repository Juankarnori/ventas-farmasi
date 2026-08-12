import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/types/database.types";

const LABEL: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  cancelado: "Cancelado",
};

const VARIANT: Record<OrderStatus, "gold" | "sage" | "neutral"> = {
  pendiente: "gold",
  recibido: "sage",
  // Mismo criterio que "Cancelado" en Apartados/Préstamos: tono neutro,
  // no un color de alerta — no es un error, es un estado resuelto más.
  cancelado: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
