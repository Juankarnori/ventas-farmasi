import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-session-profile";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { IDENTITY_COLORS } from "@/lib/utils/identity-colors";
import { RevokeEmailButton } from "@/components/equipo/revoke-email-button";
import { addAuthorizedEmail } from "./actions";
import type { AuthorizedEmailStatus, ProfileColor } from "@/lib/types/database.types";

const STATUS_LABEL: Record<AuthorizedEmailStatus, string> = {
  pendiente: "Pendiente",
  activo: "Activo",
  revocado: "Revocado",
};

const STATUS_VARIANT: Record<AuthorizedEmailStatus, "gold" | "sage" | "neutral"> = {
  pendiente: "gold",
  activo: "sage",
  revocado: "neutral",
};

export default async function EquipoPage() {
  const profile = await getSessionProfile();

  if (!profile.is_admin) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: emails } = await supabase.rpc("list_authorized_emails");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-ink">Equipo</h1>
      <p className="mt-1 text-sm text-ink/60">
        Autorizá o revocá quién puede entrar a la app con su cuenta de Google.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Autorizar correo nuevo</CardTitle>
        </CardHeader>
        <form action={addAuthorizedEmail} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="email">Correo de Google</Label>
            <Input id="email" name="email" type="email" placeholder="nombre@gmail.com" required />
          </div>
          <Button type="submit">
            <UserPlus className="h-4 w-4" /> Autorizar
          </Button>
        </form>
      </Card>

      <Card className="mt-4 p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Quién tiene acceso</CardTitle>
        </CardHeader>
        {emails && emails.length > 0 ? (
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-5">Correo</Th>
                <Th>Estado</Th>
                <Th>Perfil</Th>
                <Th>Invitado por</Th>
                <Th>Fecha</Th>
                <Th className="pr-5" />
              </Tr>
            </Thead>
            <Tbody>
              {emails.map((e) => {
                const swatch = e.profile_color
                  ? IDENTITY_COLORS[e.profile_color as ProfileColor]
                  : null;
                return (
                  <Tr key={e.id}>
                    <Td className="pl-5">{e.email}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </Td>
                    <Td>
                      {e.profile_display_name ? (
                        <span className="flex items-center gap-1.5 text-ink">
                          {swatch && (
                            <span
                              className={cn("h-2.5 w-2.5 shrink-0 rounded-full", swatch.bgClass)}
                              aria-hidden
                            />
                          )}
                          {e.profile_display_name}
                        </span>
                      ) : (
                        <span className="text-ink/40">Todavía no entró</span>
                      )}
                    </Td>
                    <Td className="text-ink/60">{e.invited_by_name ?? "—"}</Td>
                    <Td className="text-ink/60">{formatDate(e.invited_at)}</Td>
                    <Td className="pr-5">
                      {e.status !== "revocado" && (
                        <RevokeEmailButton email={e.email} hasProfile={!!e.profile_display_name} />
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink/50">Todavía no autorizaste ningún correo.</p>
        )}
      </Card>
    </div>
  );
}
