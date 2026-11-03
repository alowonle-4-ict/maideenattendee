import { AppShell } from "@/components/dashboard/app-shell";
import { requireAuth } from "@/lib/auth";
import { NAVIGATION } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LecturerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("name")
    .eq("id", ctx.institutionId ?? "")
    .maybeSingle();

  return (
    <AppShell
      role="lecturer"
      roleLabel="Lecturer"
      user={{
        fullName: ctx.profile?.full_name ?? "Lecturer",
        email: ctx.profile?.email ?? ctx.user.email ?? "",
        avatarUrl: ctx.profile?.avatar_url,
      }}
      institutionName={institution?.name ?? "Institution"}
      groups={NAVIGATION.lecturer}
      profileHref="/lecturer/profile"
    >
      {children}
    </AppShell>
  );
}
