import { Label, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createExpense } from "@/app/(app)/finanzas/actions";
import { todayISO } from "@/lib/utils/date";

export function ExpensesForm() {
  return (
    <form action={createExpense} className="flex flex-wrap items-end gap-3">
      <div className="w-40">
        <Label htmlFor="expense_date">Fecha</Label>
        <Input id="expense_date" name="expense_date" type="date" defaultValue={todayISO()} required />
      </div>
      <div className="w-40">
        <Label htmlFor="category">Categoría</Label>
        <Select id="category" name="category" defaultValue="otro">
          <option value="envio">Envío</option>
          <option value="empaque">Empaque</option>
          <option value="publicidad">Publicidad</option>
          <option value="otro">Otro</option>
        </Select>
      </div>
      <div className="min-w-[160px] flex-1">
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" name="description" placeholder="Ej: cajas para envíos" />
      </div>
      <div className="w-36">
        <Label htmlFor="amount">Monto</Label>
        <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
      </div>
      <Button type="submit">Agregar gasto</Button>
    </form>
  );
}
