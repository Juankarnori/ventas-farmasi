import type { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils/date";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface PendingFollowUp {
  id: string;
  // true = la tarea es de un prospecto (regla 'despues_de_contacto'),
  // false = es de una clienta (mismo criterio que
  // follow_up_tasks_customer_xor_prospect_check: nunca los dos ni
  // ninguno).
  isProspect: boolean;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
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

  // Una tarea 'despues_de_venta' (tiene sale_id) no se muestra hasta que
  // se entregó TODO lo de esa venta — no tiene sentido preguntar "¿cómo
  // te fue con el producto?" a quien todavía no lo recibió (típico de un
  // apartado que tarda en entregarse). Las de cumpleaños/prospectos
  // (sale_id null) no les aplica esta regla. Pasa por una función
  // security definer porque sale_items es privado por RLS y Clientes es
  // compartido — una usuaria tiene que poder ver que el apartado de OTRA
  // sigue sin entregar, no solo los propios.
  const { data: undelivered } = await supabase.rpc("get_undelivered_sale_ids");
  const undeliveredSaleIds = new Set((undelivered ?? []).map((r) => r.sale_id));
  const visibleTasks = (pendingTasks ?? []).filter(
    (t) => !t.sale_id || !undeliveredSaleIds.has(t.sale_id),
  );

  const customerIds = [...new Set(visibleTasks.filter((t) => t.customer_id).map((t) => t.customer_id as string))];
  const prospectIds = [...new Set(visibleTasks.filter((t) => t.prospect_id).map((t) => t.prospect_id as string))];

  const [{ data: customers }, { data: prospects }] = await Promise.all([
    customerIds.length > 0
      ? supabase.from("customers").select("id, name, phone").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    prospectIds.length > 0
      ? supabase.from("prospects").select("id, name, phone").in("id", prospectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const prospectById = new Map((prospects ?? []).map((p) => [p.id, p]));

  return visibleTasks.map((t) => {
    if (t.prospect_id) {
      const prospect = prospectById.get(t.prospect_id);
      return {
        id: t.id,
        isProspect: true,
        contactId: t.prospect_id,
        contactName: prospect?.name ?? "—",
        contactPhone: prospect?.phone ?? null,
        dueDate: t.due_date,
        messagePreview: t.message_preview,
      };
    }

    const customer = customerById.get(t.customer_id as string);
    return {
      id: t.id,
      isProspect: false,
      contactId: t.customer_id as string,
      contactName: customer?.name ?? "—",
      contactPhone: customer?.phone ?? null,
      dueDate: t.due_date,
      messagePreview: t.message_preview,
    };
  });
}
