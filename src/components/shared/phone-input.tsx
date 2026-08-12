"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PHONE_COUNTRIES, parsePhoneWithCountry } from "@/lib/utils/phone-countries";

// Selector de país + número local, usado en el alta y edición de
// Clientes. El valor real que viaja en el form es un solo campo oculto
// `name="phone"` con el número completo (ej. "+51987654321") — nadie
// más tiene que enterarse de que son dos inputs separados, todo lo que
// ya lee `customers.phone` sigue funcionando igual.
export function PhoneInput({ id = "phone", defaultValue }: { id?: string; defaultValue?: string | null }) {
  const parsed = parsePhoneWithCountry(defaultValue ?? "");
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [local, setLocal] = useState(parsed.local);

  const localDigits = local.replace(/\D/g, "");
  const combined = localDigits ? `+${dialCode}${localDigits}` : "";

  return (
    <div>
      <Label htmlFor={`${id}_local`}>Teléfono (opcional)</Label>
      <div className="flex gap-2">
        <div className="w-36 shrink-0">
          <Select aria-label="País" value={dialCode} onChange={(e) => setDialCode(e.target.value)}>
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.dialCode}>
                {c.flag} {c.name} +{c.dialCode}
              </option>
            ))}
          </Select>
        </div>
        <Input
          id={`${id}_local`}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="987654321"
          className="flex-1"
        />
      </div>
      <input type="hidden" name={id} value={combined} />
    </div>
  );
}
