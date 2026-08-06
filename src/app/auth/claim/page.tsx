import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { IDENTITY_COLORS, IDENTITY_COLOR_KEYS } from "@/lib/utils/identity-colors";
import { createOwnProfile } from "../actions";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect("/");
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h1 className="font-display text-2xl text-ink">¡Bienvenida!</h1>
        <p className="mt-1 text-sm text-ink/60">
          Elegí tu nombre y un color — solo se pregunta una vez por cuenta.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-accent/20 px-3 py-2 text-sm text-ink">
          No pudimos crear tu perfil. Revisá los datos e intentá de nuevo.
        </p>
      )}

      <form action={createOwnProfile} className="flex w-full flex-col gap-5 text-left">
        <div>
          <Label htmlFor="display_name">Tu nombre</Label>
          <Input id="display_name" name="display_name" placeholder="Ej: Ana" required autoFocus />
        </div>

        <fieldset>
          <legend className="mb-2 block text-xs font-medium text-ink/70">Tu color</legend>
          <div className="flex flex-wrap gap-3">
            {IDENTITY_COLOR_KEYS.map((key, i) => {
              const swatch = IDENTITY_COLORS[key];
              return (
                <label key={key} className="flex cursor-pointer flex-col items-center gap-1.5">
                  <span className="relative">
                    <input
                      type="radio"
                      name="color"
                      value={key}
                      defaultChecked={i === 0}
                      required
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-transparent ring-offset-2 ring-offset-background transition-all peer-checked:ring-gold",
                        swatch.bgClass,
                        swatch.textClass,
                      )}
                      aria-hidden
                    >
                      A
                    </span>
                  </span>
                  <span className="text-xs text-ink/60">{swatch.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button type="submit" className="w-full">
          Crear mi perfil
        </Button>
      </form>
    </div>
  );
}
