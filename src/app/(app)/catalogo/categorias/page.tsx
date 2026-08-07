import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LineRow } from "@/components/catalogo/line-row";
import { createCategory, deleteCategory, createLine } from "./actions";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: lines }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("product_lines").select("*").order("name", { ascending: true }),
  ]);

  const linesByCategory = new Map<string, typeof lines>();
  for (const line of lines ?? []) {
    const list = linesByCategory.get(line.category_id) ?? [];
    list!.push(line);
    linesByCategory.set(line.category_id, list);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/catalogo"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
      </Link>

      <h1 className="font-display text-2xl text-ink">Categorías</h1>
      <p className="mt-1 text-sm text-ink/60">
        Cada categoría tiene un color que se usa como franja en las tarjetas de producto.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Nueva categoría</CardTitle>
        </CardHeader>
        <form action={createCategory} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Ej: Skincare" required />
          </div>
          <div>
            <Label htmlFor="color">Color</Label>
            <input
              id="color"
              name="color"
              type="color"
              defaultValue="#733865"
              className="h-10 w-16 rounded-lg border border-ink/15 bg-white/80 p-1"
            />
          </div>
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Existentes</CardTitle>
        </CardHeader>
        <ul className="divide-y divide-ink/8">
          {categories?.map((category) => (
            <li key={category.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span className="text-sm text-ink">{category.name}</span>
              </div>
              <form action={deleteCategory.bind(null, category.id)}>
                <button
                  type="submit"
                  aria-label={`Eliminar categoría ${category.name}`}
                  className="rounded-full p-1.5 text-ink/40 hover:bg-accent/20 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
          {(!categories || categories.length === 0) && (
            <li className="py-6 text-center text-sm text-ink/50">Todavía no hay categorías.</li>
          )}
        </ul>
      </Card>

      <h2 className="mt-8 font-display text-xl text-ink">Líneas</h2>
      <p className="mt-1 text-sm text-ink/60">
        Subcategorías dentro de cada categoría (ej. dentro de “Skincare”: “Tea Tree”, “Resurface”).
      </p>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Nueva línea</CardTitle>
        </CardHeader>
        {categories && categories.length > 0 ? (
          <form action={createLine} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <Label htmlFor="line-name">Nombre</Label>
              <Input id="line-name" name="name" placeholder="Ej: Tea Tree" required />
            </div>
            <div className="w-44">
              <Label htmlFor="line-category">Categoría</Label>
              <Select id="line-category" name="category_id" required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Agregar</Button>
          </form>
        ) : (
          <p className="text-sm text-ink/50">Creá al menos una categoría antes de agregar líneas.</p>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Existentes</CardTitle>
        </CardHeader>
        {categories && categories.length > 0 ? (
          <div className="flex flex-col gap-5">
            {categories.map((category) => {
              const categoryLines = linesByCategory.get(category.id) ?? [];
              return (
                <div key={category.id}>
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                      aria-hidden
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                      {category.name}
                    </span>
                  </div>
                  {categoryLines.length > 0 ? (
                    <ul className="divide-y divide-ink/8 pl-5">
                      {categoryLines.map((line) => (
                        <LineRow key={line.id} line={line} categories={categories} />
                      ))}
                    </ul>
                  ) : (
                    <p className="pl-5 text-sm text-ink/40">Sin líneas todavía.</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink/50">Todavía no hay categorías.</p>
        )}
      </Card>
    </div>
  );
}
