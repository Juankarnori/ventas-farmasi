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
}
