import Link from "next/link";
import { AlertTriangle, ScanLine } from "lucide-react";

import { SessionForm } from "@/components/lecturer/session-form";
import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NewAttendancePage() {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("course_lecturers")
    .select("course:courses(id, code, title)")
    .eq("lecturer_id", ctx.user.id);

  const courses = (assignments ?? [])
    .map((row) => row.course as unknown as { id: string; code: string; title: string } | null)
    .filter((course): course is NonNullable<typeof course> => course !== null);

  const ids = courses.map((course) => course.id);
  const { data: registrations } = ids.length
    ? await supabase.from("course_registrations").select("course_id").in("course_id", ids).eq("status", "registered")
    : { data: [] as { course_id: string }[] };

  const counts = new Map<string, number>();
  (registrations ?? []).forEach((row) => counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1));

  return (
    <div className="page-shell max-w-3xl">
      <PageHeader
        eyebrow="New attendance"
        title="Start attendance"
        description="Create a session, then scan students' permanent QR codes. The scanner downloads the roster so it keeps working offline."
        actions={
          <Button asChild variant="outline">
            <Link href="/lecturer/history">History</Link>
          </Button>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title="No courses assigned"
          description="You can only start attendance for courses your administrator has assigned to you."
        />
      ) : (
        <>
          {courses.every((course) => (counts.get(course.id) ?? 0) === 0) && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                None of your courses have registered students yet. Students must be registered before their
                QR codes can be accepted for this course.
              </p>
            </div>
          )}
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <SessionForm
              courses={courses.map((course) => ({
                id: course.id,
                label: `${course.code} — ${course.title}`,
                students: counts.get(course.id) ?? 0,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
