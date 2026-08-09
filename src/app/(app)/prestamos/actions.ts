"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import type { LoanValuationType, LoanSettlementMethod } from "@/lib/types/database.types";

function readValuationType(formData: FormData): LoanValuationType {
  const raw = String(formData.get("valuation_type") ?? "costo");
  if (raw !== "costo" && raw !== "pvp" && raw !== "promocion") {
    throw new Error("Tipo de valoración inválido");
  }
  return raw;
}

// Solo se usa (y solo se manda al server) cuando valuation_type =
// 'promocion' — para 'costo'/'pvp' el precio sale calculado del producto,
// no hace falta nada acá. El RPC igual vuelve a validar esto (nunca
// confiar solo en el chequeo del cliente).
function readCustomPrice(formData: FormData, valuationType: LoanValuationType): number | null {
  if (valuationType !== "promocion") return null;
  const raw = Number(formData.get("custom_price"));
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error("Ingresá el precio de promoción de esta unidad");
  }
  return raw;
}

export async function createLoan(formData: FormData) {
  await getSessionProfile();
  const supabase = await createClient();

  const variantId = String(formData.get("variant_id") ?? "");
  const quantity = Number(formData.get("quantity"));
  const direction = String(formData.get("direction") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const valuationType = readValuationType(formData);
  const customPrice = readCustomPrice(formData, valuationType);
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
    p_valuation_type: valuationType,
    p_custom_price: customPrice,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prestamos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  redirect("/prestamos");
}

// Edición completa (variante/cantidad/valoración) — solo mientras el
// préstamo sigue 'pendiente' (ver update_loan). Igual que en Ventas, se
// pasa el id ya bindeado desde la página.
//
// Devuelve { error? } en vez de tirar una excepción: en producción,
// Next.js oculta el mensaje real de cualquier throw no atrapado en una
// Server Action y lo reemplaza por un texto genérico + digest — hace
// falta que nunca se lance como excepción para que el mensaje real le
// llegue al cliente. Todo el cuerpo queda envuelto en su propio
// try/catch en vez de convertir cada `throw` suelto uno por uno.
export async function updateLoan(loanId: string, formData: FormData): Promise<{ error?: string }> {
  try {
    await getSessionProfile();
    const supabase = await createClient();

    const variantId = String(formData.get("variant_id") ?? "");
    const quantity = Number(formData.get("quantity"));
    const note = String(formData.get("note") ?? "").trim() || null;
    const valuationType = readValuationType(formData);
    const customPrice = readCustomPrice(formData, valuationType);

    if (!variantId) {
      throw new Error("Elegí un producto");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("La cantidad tiene que ser mayor a 0");
    }

    const { error } = await supabase.rpc("update_loan", {
      p_loan_id: loanId,
      p_variant_id: variantId,
      p_quantity: quantity,
      p_valuation_type: valuationType,
      p_note: note,
      p_custom_price: customPrice,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/prestamos");
    revalidatePath(`/prestamos/${loanId}`);
    revalidatePath("/inventario");
    revalidatePath("/catalogo");
    revalidatePath("/finanzas");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el préstamo. Intentá de nuevo." };
  }
}

// Edición liviana: cómo se pagó/devolvió un préstamo ya resuelto — no
// toca stock ni cantidades.
export async function updateLoanSettlement(
  loanId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    await getSessionProfile();
    const supabase = await createClient();

    const raw = String(formData.get("settlement_method") ?? "");
    if (raw !== "efectivo" && raw !== "transferencia" && raw !== "producto") {
      throw new Error("Método inválido");
    }
    const settlementMethod: LoanSettlementMethod = raw;
    const settlementAmount = Number(formData.get("settlement_amount"));
    const bankNote = String(formData.get("settlement_bank_note") ?? "").trim() || null;

    if (!Number.isFinite(settlementAmount) || settlementAmount < 0) {
      throw new Error("El monto pagado tiene que ser mayor o igual a 0");
    }

    const { error } = await supabase.rpc("update_loan_settlement", {
      p_loan_id: loanId,
      p_settlement_method: settlementMethod,
      p_settlement_amount: settlementAmount,
      p_settlement_bank_note: bankNote,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/prestamos");
    revalidatePath(`/prestamos/${loanId}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el pago. Intentá de nuevo." };
  }
}

export async function markLoanReturned(loanId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_loan_returned", { p_loan_id: loanId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/prestamos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  return {};
}

export async function markLoanSold(loanId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_loan_sold", { p_loan_id: loanId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/prestamos");
  revalidatePath("/finanzas");
  return {};
}

// Eliminar un préstamo desde cualquiera de los 3 estados — delete_loan
// revierte el stock solo si estaba 'pendiente' (ver 0038); si tiene una
// deuda 'vendido' sin liquidar, la advertencia ya se le mostró a la
// usuaria del lado del cliente antes de llegar acá (no se bloquea nada
// acá, es su decisión).
export async function deleteLoan(loanId: string): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_loan", { p_loan_id: loanId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/prestamos");
  revalidatePath("/inventario");
  revalidatePath("/catalogo");
  revalidatePath("/finanzas");
  return {};
}

export async function settleAllDebts(): Promise<{ error?: string }> {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("settle_loan_debts");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/prestamos");
  revalidatePath("/finanzas");
  return {};
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
