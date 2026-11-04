import { AppShell } from "@/components/dashboard/app-shell";
import { requireInstitution } from "@/lib/auth";
import { NAVIGATION } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireInstitution();
  const supabase = await createClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("name, logo_url")
    .eq("id", ctx.institutionId)
    .maybeSingle();

  return (
    <AppShell
      role="institution_admin"
      roleLabel="Institution Administrator"
      user={{
        fullName: ctx.profile?.full_name ?? "Institution Administrator",
        email: ctx.profile?.email ?? ctx.user.email ?? "",
        avatarUrl: ctx.profile?.avatar_url,
      }}
      institutionName={institution?.name ?? "Institution"}
      institutionLogoUrl={institution?.logo_url ?? null}
      groups={NAVIGATION.institution_admin}
      profileHref="/admin/settings"
    >
      {children}
    </AppShell>
  );
}
