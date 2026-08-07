import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CustomerForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required autoFocus />
      </div>
      <div>
        <Label htmlFor="phone">Teléfono (opcional)</Label>
        <Input id="phone" name="phone" placeholder="Ej: 098 765 4321" />
      </div>
      <div>
        <Label htmlFor="birth_date">Cumpleaños (opcional)</Label>
        <Input id="birth_date" name="birth_date" type="date" />
      </div>
      <div>
        <Label htmlFor="notes">Notas y preferencias (opcional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Ej: prefiere tonos coral, alérgica a fragancias fuertes..."
        />
      </div>
      <Button type="submit" className="w-fit">
        Guardar clienta
      </Button>
    </form>
  );
}
