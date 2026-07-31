import { getSessionProfile } from "@/lib/auth/get-session-profile";

// TODO: cuando el módulo de Finanzas esté listo, esta página redirige a
// /finanzas (el dashboard es la pantalla de inicio).
export default async function HomePage() {
  const profile = await getSessionProfile();

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Hola, {profile.display_name}</h1>
      <p className="mt-2 text-ink/60">El dashboard de Finanzas está en construcción.</p>
    </div>
  );
}
