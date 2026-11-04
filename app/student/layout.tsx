import { AppShell } from "@/components/dashboard/app-shell";
import { requireAuth } from "@/lib/auth";
import { NAVIGATION } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("name, logo_url")
    .eq("id", ctx.institutionId ?? "")
    .maybeSingle();

  return (
    <AppShell
      role="student"
      roleLabel="Student"
      user={{
        fullName: ctx.profile?.full_name ?? "Student",
        email: ctx.profile?.email ?? ctx.user.email ?? "",
        avatarUrl: ctx.profile?.avatar_url,
      }}
      institutionName={institution?.name ?? "Institution"}
      institutionLogoUrl={institution?.logo_url ?? null}
      groups={NAVIGATION.student}
      profileHref="/student/profile"
    >
      {children}
    </AppShell>
  );
}
