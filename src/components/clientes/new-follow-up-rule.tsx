"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FollowUpRuleForm } from "./follow-up-rule-form";
import { createFollowUpRule } from "@/app/(app)/clientes/reglas/actions";

export function NewFollowUpRule() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nueva regla
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-gold/20 bg-surface p-4">
      <FollowUpRuleForm
        action={async (formData) => {
          await createFollowUpRule(formData);
          setOpen(false);
        }}
        submitLabel="Crear regla"
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
