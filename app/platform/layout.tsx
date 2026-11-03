import { AppShell } from "@/components/dashboard/app-shell";
import { requireAuth } from "@/lib/auth";
import { NAVIGATION } from "@/lib/navigation";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuth(["super_admin"]);

  return (
    <AppShell
      role="super_admin"
      roleLabel="Super Administrator"
      user={{
        fullName: ctx.profile?.full_name ?? "Platform Administrator",
        email: ctx.profile?.email ?? ctx.user.email ?? "",
        avatarUrl: ctx.profile?.avatar_url,
      }}
      institutionName="MaideenAttendee Platform"
      groups={NAVIGATION.super_admin}
      profileHref="/platform/settings"
    >
      {children}
    </AppShell>
  );
}
