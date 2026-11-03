import Link from "next/link";
import { BookOpen, ShieldCheck, UserCog } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/dashboard/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function LecturerProfilePage() {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const [{ data: institution }, { data: department }, { data: assignments }] =
    await Promise.all([
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
      supabase
        .from("course_lecturers")
        .select("course:courses(code, title)")
        .eq("lecturer_id", ctx.user.id),
    ]);

  const faculty = department?.faculty as unknown as { name: string } | null;
  const courses = (assignments ?? [])
    .map((row) => row.course as unknown as { code: string; title: string } | null)
    .filter((course): course is NonNullable<typeof course> => course !== null);

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        title="My profile"
        description="Manage your account details. Your staff number and assigned courses are managed by your institution administrator."
        actions={
          <Button asChild variant="outline">
            <Link href="/lecturer/courses">
              <BookOpen /> My courses
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Personal information"
          description="Your name appears on attendance registers and exported reports."
        >
          <ProfileForm
            fullName={ctx.profile?.full_name ?? ""}
            phone={ctx.profile?.phone ?? null}
            email={ctx.user.email ?? ctx.profile?.email ?? ""}
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Staff record">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Staff number</dt>
                <dd className="font-mono text-xs">{ctx.profile?.staff_number ?? "—"}</dd>
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
                <dt className="text-muted-foreground">Joined</dt>
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

          <SectionCard
            title="Assigned courses"
            description={`${courses.length} course${courses.length === 1 ? "" : "s"}`}
          >
            {courses.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {courses.slice(0, 6).map((course) => (
                  <li key={course.code} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>
                      <span className="font-mono text-xs text-muted-foreground">{course.code}</span>{" "}
                      {course.title}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No courses assigned yet. Contact your institution administrator.
              </p>
            )}
            {courses.length > 0 && (
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href="/lecturer/courses">
                  <UserCog /> Open course workspace
                </Link>
              </Button>
            )}
          </SectionCard>

          <SectionCard title="Account security">
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p>
                Only you and your institution administrators can see your profile. You can only take
                attendance for courses assigned to you.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
