"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CategoryLineFilter } from "@/components/shared/category-line-filter";

export function CatalogoFilters({
  categories,
  lines,
}: {
  categories: { id: string; name: string }[];
  lines: { id: string; name: string; category_id: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      else params.delete("q");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function onCategoryChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("categoria", value);
    else params.delete("categoria");
    // Resetea la línea activa en el mismo replace: una línea de otra
    // categoría ya no aplica.
    params.delete("linea");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto..."
          className="pl-9"
        />
      </div>
      <CategoryLineFilter
        categories={categories}
        lines={lines}
        categoryId={searchParams.get("categoria") ?? ""}
        lineId={searchParams.get("linea") ?? ""}
        onCategoryChange={onCategoryChange}
        onLineChange={(id) => updateParam("linea", id)}
      />
    </div>
  );
}
