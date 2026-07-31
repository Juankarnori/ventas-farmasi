import { Badge } from "@/components/ui/badge";

export function LowStockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  const low = stock <= threshold;
  return <Badge variant={low ? "accent" : "sage"}>{low ? "Stock bajo" : "Stock OK"}</Badge>;
}
