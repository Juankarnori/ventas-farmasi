"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";

export async function createLoan(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const variantId = String(formData.get("variant_id") ?? "");
  const quantity = Number(formData.get("quantity"));
  const direction = String(formData.get("direction") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const [fromProfileId, toProfileId] = direction.split(":");

  if (!variantId || !fromProfileId || !toProfileId) {
    throw new Error("Faltan datos del préstamo");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("La cantidad tiene que ser mayor a 0");
  }

  const { error } = await supabase.rpc("create_loan", {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_from_profile_id: fromProfileId,
    p_to_profile_id: toProfileId,
    p_note: note,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prestamos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  redirect("/prestamos");
}

export async function markLoanReturned(loanId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_loan_returned", { p_loan_id: loanId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prestamos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
}

export async function markLoanSold(loanId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_loan_sold", { p_loan_id: loanId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prestamos");
  revalidatePath("/finanzas");
}

export async function settleAllDebts() {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("settle_loan_debts");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prestamos");
  revalidatePath("/finanzas");
}

export interface BorrowableStockOption {
  profileId: string;
  displayName: string;
  stock: number;
}

// Para el botón "Pedir prestado" dentro del flujo de venta: a quién más
// del equipo le queda stock de esta variante puntual, para elegir a
// quién pedirle. Se llama directamente (no como form action) porque el
// resultado se usa para llenar un selector antes de mostrar nada.
export async function getBorrowableStock(variantId: string): Promise<BorrowableStockOption[]> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: stockRows } = await supabase
    .from("variant_stock")
    .select("profile_id, stock")
    .eq("variant_id", variantId)
    .neq("profile_id", profile.id)
    .gt("stock", 0);

  if (!stockRows || stockRows.length === 0) return [];

  const profileIds = stockRows.map((s) => s.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", profileIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return stockRows
    .map((s) => ({
      profileId: s.profile_id,
      displayName: nameById.get(s.profile_id) ?? "—",
      stock: s.stock,
    }))
    .sort((a, b) => b.stock - a.stock);
}

// Versión liviana de createLoan para el mismo flujo: no redirige a
// /prestamos (seguimos armando la venta) y devuelve el error en vez de
// tirarlo, para que el diálogo de "Pedir prestado" lo muestre inline sin
// perder lo que ya se había cargado en el formulario de venta.
export async function createLoanQuick(
  variantId: string,
  fromProfileId: string,
  quantity: number,
): Promise<{ error?: string }> {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "La cantidad tiene que ser mayor a 0" };
  }

  const { error } = await supabase.rpc("create_loan", {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_from_profile_id: fromProfileId,
    p_to_profile_id: profile.id,
    p_note: "Pedido desde el flujo de venta (faltaba stock propio)",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/prestamos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  return {};
}
