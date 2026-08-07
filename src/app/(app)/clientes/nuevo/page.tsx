import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerForm } from "@/components/clientes/customer-form";
import { createCustomer } from "../actions";

export default function NuevaClientaPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>
      <h1 className="mb-6 font-display text-2xl text-ink">Nueva clienta</h1>
      <CustomerForm action={createCustomer} />
    </div>
  );
}
