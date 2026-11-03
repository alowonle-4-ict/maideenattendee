import Link from "next/link";
import { QrCode, ShieldCheck, UserCog } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/dashboard/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function StudentProfilePage() {
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();

  const [{ data: institution }, { data: department }] = await Promise.all([
    ctx.institutionId
      ? supabase.from("institutions").select("name").eq("id", ctx.institutionId).maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.profile?.department_id
      ? supabase
          .from("departments")
          .select("name, code, faculty:faculties(name)")
          .eq("id", ctx.profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const faculty = department?.faculty as unknown as { name: string } | null;

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        title="My profile"
        description="Keep your contact details up to date. Your matric number and institution record are managed by your administrator."
        actions={
          <Button asChild variant="outline">
            <Link href="/student/qr">
              <QrCode /> My QR code
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Personal information"
          description="Your name and phone number appear on class registers."
        >
          <ProfileForm
            fullName={ctx.profile?.full_name ?? ""}
            phone={ctx.profile?.phone ?? null}
            email={ctx.user.email ?? ctx.profile?.email ?? ""}
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Student record">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Matric number</dt>
                <dd className="font-mono text-xs">{ctx.profile?.matric_number ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Department</dt>
                <dd className="text-right">{department?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Faculty</dt>
                <dd className="text-right">{faculty?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Institution</dt>
                <dd className="text-right">{institution?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Enrolled</dt>
                <dd className="text-right">{formatDate(ctx.profile?.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Account</dt>
                <dd>
                  {ctx.profile?.is_active ?? true ? (
                    <span className="text-success">Active</span>
                  ) : (
                    <span className="text-destructive">Inactive</span>
                  )}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Account security">
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p>
                Only you and your institution administrators can see your profile. Your password is
                never visible to staff — use the password form to change it.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/student/notifications">
                <UserCog /> View notifications
              </Link>
            </Button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
