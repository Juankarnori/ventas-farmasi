import { Label, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function LoanForm({
  products,
  profiles,
  action,
}: {
  products: { id: string; name: string }[];
  profiles: { id: string; display_name: string }[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="direction">De quién a quién</Label>
        <Select id="direction" name="direction" required>
          {profiles.map((from) =>
            profiles
              .filter((to) => to.id !== from.id)
              .map((to) => (
                <option key={`${from.id}:${to.id}`} value={`${from.id}:${to.id}`}>
                  {from.display_name} → {to.display_name}
                </option>
              )),
          )}
        </Select>
      </div>

      <div>
        <Label htmlFor="product_id">Producto</Label>
        <Select id="product_id" name="product_id" required>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-32">
        <Label htmlFor="quantity">Cantidad</Label>
        <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
      </div>

      <div>
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" name="note" rows={2} placeholder="Ej: para probarlo con una clienta" />
      </div>

      <Button type="submit" disabled={products.length === 0}>
        Registrar préstamo
      </Button>
    </form>
  );
}
