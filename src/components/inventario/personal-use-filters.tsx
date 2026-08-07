"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function PersonalUseFilters({ profiles }: { profiles: { id: string; display_name: string }[] }) {
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
        <Label htmlFor="pu_desde">Desde</Label>
        <Input
          id="pu_desde"
          type="date"
          defaultValue={searchParams.get("desde") ?? ""}
          onChange={(e) => update("desde", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="pu_hasta">Hasta</Label>
        <Input
          id="pu_hasta"
          type="date"
          defaultValue={searchParams.get("hasta") ?? ""}
          onChange={(e) => update("hasta", e.target.value)}
        />
      </div>
      <div className="w-44">
        <Label htmlFor="pu_usuaria">Usuaria</Label>
        <Select
          id="pu_usuaria"
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
    </div>
  );
}
