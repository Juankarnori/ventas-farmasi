"use client";

import { useRouter } from "next/navigation";
import { ProspectForm } from "./prospect-form";
import { createProspect } from "@/app/(app)/clientes/prospectos/actions";

// Envoltorio fino solo para volver al listado cuando el alta se guarda
// bien — ProspectForm en sí no sabe nada de navegación, así se puede
// seguir usando tal cual para editar inline en la ficha del prospecto.
export function ProspectCreateForm() {
  const router = useRouter();

  return (
    <ProspectForm
      action={createProspect}
      onCancel={() => router.push("/clientes/prospectos")}
      onSuccess={() => router.push("/clientes/prospectos")}
    />
  );
}
