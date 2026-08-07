import type { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils/date";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface PendingFollowUp {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  dueDate: string;
  messagePreview: string;
}

// "Hoy toca contactar": tareas pendientes con due_date <= hoy (incluye
// atrasadas). Se usa tal cual tanto en Clientes (la vista completa, con
// acciones de WhatsApp/marcar contactado) como en el resumen de Inicio —
// una sola función para que las dos coincidan siempre, en vez de dos
// queries paralelas que puedan desincronizarse.
export async function getPendingFollowUps(supabase: SupabaseServerClient): Promise<PendingFollowUp[]> {
  const { data: pendingTasks } = await supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("status", "pendiente")
    .lte("due_date", todayISO())
    .order("due_date", { ascending: true });

  const customerIds = [...new Set((pendingTasks ?? []).map((t) => t.customer_id))];
  const { data: customers } =
    customerIds.length > 0
      ? await supabase.from("customers").select("id, name, phone").in("id", customerIds)
      : { data: [] };
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  return (pendingTasks ?? []).map((t) => ({
    id: t.id,
    customerId: t.customer_id,
    customerName: customerById.get(t.customer_id)?.name ?? "—",
    customerPhone: customerById.get(t.customer_id)?.phone ?? null,
    dueDate: t.due_date,
    messagePreview: t.message_preview,
  }));
}
