import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/types/database.types";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={status === "recibido" ? "sage" : "gold"}>
      {status === "recibido" ? "Recibido" : "Pendiente"}
    </Badge>
  );
}
