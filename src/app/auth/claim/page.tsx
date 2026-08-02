import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { claimProfile } from "../actions";

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

  const { data: openSlots } = await supabase
    .from("profiles")
    .select("*")
    .is("user_id", null);

  if (!openSlots || openSlots.length === 0) {
    await supabase.auth.signOut();
    redirect("/auth/unauthorized");
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h1 className="font-display text-2xl text-ink">¿Sos Mamá o Yo?</h1>
        <p className="mt-1 text-sm text-ink/60">
          Elegí tu perfil — solo se pregunta una vez por cuenta.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-accent/20 px-3 py-2 text-sm text-ink">
          Ese perfil ya no está disponible. Probá con otro o pedí ayuda.
        </p>
      )}

      <div className="flex w-full flex-col gap-3">
        {openSlots.map((slot) => (
          <form key={slot.id} action={claimProfile.bind(null, slot.id)}>
            <button
              type="submit"
              className={`w-full rounded-full px-5 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                slot.color === "turquoise"
                  ? "bg-primary text-background hover:bg-primary/90"
                  : "bg-gold text-ink hover:bg-gold/90"
              }`}
            >
              {slot.display_name}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
