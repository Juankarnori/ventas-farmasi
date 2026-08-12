import type { createClient } from "@/lib/supabase/server";
import type { FollowUpTaskStatus } from "@/lib/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface CalendarFollowUpEntry {
  id: string;
  day: number; // 1-31, día del due_date dentro del mes pedido
  // true = tarea de un prospecto (regla 'despues_de_contacto'), igual
  // criterio que getPendingFollowUps — nunca hay customerId Y
  // prospectId a la vez.
  isProspect: boolean;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  dueDate: string;
  messagePreview: string;
  status: FollowUpTaskStatus;
  // Solo relevante para status 'pendiente' con sale_id: la misma regla
  // que oculta la tarea de "Hoy toca contactar" mientras la venta no se
  // entregó del todo (ver get_undelivered_sale_ids / getPendingFollowUps).
  hiddenByDelivery: boolean;
}

export interface CalendarBirthdayEntry {
  day: number;
  customerId: string;
  customerName: string;
}

export interface CalendarMonthData {
  followUps: CalendarFollowUpEntry[];
  birthdays: CalendarBirthdayEntry[];
}

// Todo lo que cae en un mes dado para el Calendario de Clientes:
// tareas de seguimiento (con su estado de "oculta por entrega pendiente")
// y cumpleaños de clientas. Comparte criterio y helpers con
// getPendingFollowUps (misma función get_undelivered_sale_ids para no
// duplicar la lógica de privacidad de sale_items) para que las dos vistas
// nunca puedan desincronizarse.
export async function getCalendarMonthData(
  supabase: SupabaseServerClient,
  { year, month }: { year: number; month: number }, // month: 1-12
): Promise<CalendarMonthData> {
  const monthStr = String(month).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  const from = `${year}-${monthStr}-01`;
  const to = `${year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

  const [{ data: tasks }, { data: undelivered }] = await Promise.all([
    supabase
      .from("follow_up_tasks")
      .select("id, customer_id, prospect_id, due_date, status, sale_id, message_preview")
      .gte("due_date", from)
      .lte("due_date", to)
      .order("due_date", { ascending: true }),
    supabase.rpc("get_undelivered_sale_ids"),
  ]);

  const undeliveredSaleIds = new Set((undelivered ?? []).map((r) => r.sale_id));

  const taskCustomerIds = [...new Set((tasks ?? []).filter((t) => t.customer_id).map((t) => t.customer_id as string))];
  const taskProspectIds = [...new Set((tasks ?? []).filter((t) => t.prospect_id).map((t) => t.prospect_id as string))];
  const [{ data: taskCustomers }, { data: taskProspects }] = await Promise.all([
    taskCustomerIds.length > 0
      ? supabase.from("customers").select("id, name, phone").in("id", taskCustomerIds)
      : Promise.resolve({ data: [] }),
    taskProspectIds.length > 0
      ? supabase.from("prospects").select("id, name, phone").in("id", taskProspectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const customerById = new Map((taskCustomers ?? []).map((c) => [c.id, c]));
  const prospectById = new Map((taskProspects ?? []).map((p) => [p.id, p]));

  const followUps: CalendarFollowUpEntry[] = (tasks ?? []).map((t) => {
    const isProspect = t.prospect_id !== null;
    const contact = isProspect ? prospectById.get(t.prospect_id as string) : customerById.get(t.customer_id as string);

    return {
      id: t.id,
      day: Number(t.due_date.slice(8, 10)),
      isProspect,
      contactId: (isProspect ? t.prospect_id : t.customer_id) as string,
      contactName: contact?.name ?? "—",
      contactPhone: contact?.phone ?? null,
      dueDate: t.due_date,
      messagePreview: t.message_preview,
      status: t.status,
      hiddenByDelivery: t.status === "pendiente" && t.sale_id !== null && undeliveredSaleIds.has(t.sale_id),
    };
  });

  // Cumpleaños del mes: se calcula del lado de acá (mes/día de
  // birth_date, sin importar el año) en vez de leer las follow_up_tasks
  // de tipo 'cumpleanos', porque el ícono tiene que aparecer aunque no
  // haya ninguna regla de cumpleaños activa o el cron todavía no haya
  // corrido ese día — mismo criterio de cálculo que run_birthday_check y
  // que calculateAge/formatBirthday en el front. Las archivadas quedan
  // afuera, mismo criterio que el listado general de Clientes.
  const { data: customersWithBirthday } = await supabase
    .from("customers")
    .select("id, name, birth_date")
    .not("birth_date", "is", null)
    .is("archived_at", null);

  const birthdays: CalendarBirthdayEntry[] = (customersWithBirthday ?? [])
    .filter((c) => c.birth_date && Number(c.birth_date.slice(5, 7)) === month)
    .map((c) => ({
      day: Number(c.birth_date!.slice(8, 10)),
      customerId: c.id,
      customerName: c.name,
    }));

  return { followUps, birthdays };
}
