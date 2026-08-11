import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProspectCreateForm } from "@/components/clientes/prospect-create-form";

export default function NuevoProspectoPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/clientes/prospectos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a prospectos
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nuevo prospecto</h1>
      <ProspectCreateForm />
    </div>
  );
}
