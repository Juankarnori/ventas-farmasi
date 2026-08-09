"use client";

import { useRouter } from "next/navigation";
import { PersonalUseForm, type PersonalUseDefaults, type PersonalUseProduct } from "./personal-use-form";

// Envoltorio fino solo para volver al historial cuando la edición se
// guarda bien (o se cancela) — PersonalUseForm en sí no sabe nada de
// navegación, así se puede seguir usando tal cual para el alta en la
// página principal de Uso personal.
export function PersonalUseEditForm({
  entryId,
  products,
  categories,
  lines,
  defaults,
  action,
}: {
  entryId: string;
  products: PersonalUseProduct[];
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
  defaults: PersonalUseDefaults;
  action: (entryId: string, formData: FormData) => Promise<{ error?: string }>;
}) {
  const router = useRouter();

  return (
    <PersonalUseForm
      products={products}
      categories={categories}
      lines={lines}
      defaults={defaults}
      submitLabel="Guardar cambios"
      action={(formData) => action(entryId, formData)}
      onCancel={() => router.push("/inventario/uso-personal")}
      onSuccess={() => router.push("/inventario/uso-personal")}
    />
  );
}
