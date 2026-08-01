"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { expenseSchema } from "@/lib/validations/expense";

export async function createExpense(formData: FormData) {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const parsed = expenseSchema.safeParse({
    expense_date: formData.get("expense_date"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { error } = await supabase.from("expenses").insert({
    expense_date: parsed.data.expense_date,
    category: parsed.data.category,
    description: parsed.data.description || null,
    amount: parsed.data.amount,
    created_by: profile.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/finanzas");
}

export async function deleteExpense(expenseId: string) {
  await getSessionProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/finanzas");
}
