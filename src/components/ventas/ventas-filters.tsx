"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function VentasFilters({
  profiles,
  products,
}: {
  profiles: { id: string; display_name: string }[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <Input
          type="date"
          defaultValue={searchParams.get("desde") ?? ""}
          onChange={(e) => update("desde", e.target.value)}
          aria-label="Desde"
        />
      </div>
      <div>
        <Input
          type="date"
          defaultValue={searchParams.get("hasta") ?? ""}
          onChange={(e) => update("hasta", e.target.value)}
          aria-label="Hasta"
        />
      </div>
      <div className="w-44">
        <Select
          defaultValue={searchParams.get("usuaria") ?? ""}
          onChange={(e) => update("usuaria", e.target.value)}
        >
          <option value="">Todas las usuarias</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-56">
        <Select
          defaultValue={searchParams.get("producto") ?? ""}
          onChange={(e) => update("producto", e.target.value)}
        >
          <option value="">Todos los productos</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
