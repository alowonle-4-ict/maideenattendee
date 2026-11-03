import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attendanceTone, formatPercent, percentage } from "@/lib/utils";

export default async function StudentCoursesPage() {
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();

  const [{ data: registrations }, { data: summaries }] = await Promise.all([
    supabase
      .from("course_registrations")
      .select(
        "course_id, registered_at, course:courses(id, code, title, credit_units, level, department:departments(name))"
      )
      .eq("student_id", ctx.user.id)
      .eq("status", "registered"),
    supabase
      .from("student_course_attendance")
      .select("course_id, classes_held, attended")
      .eq("student_id", ctx.user.id),
  ]);

  const summaryMap = new Map((summaries ?? []).map((row) => [row.course_id, row]));
  const courses = (registrations ?? [])
    .map((row) =>
      row.course as unknown as {
        id: string;
        code: string;
        title: string;
        credit_units: number;
        level: string | null;
        department: { name: string } | null;
      } | null
    )
    .filter((course): course is NonNullable<typeof course> => course !== null);

  return (
    <div className="page-shell">
      <PageHeader
        title="My courses"
        description="Courses your institution has registered you for. Attendance is tracked separately for each course."
      />

      {courses.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const summary = summaryMap.get(course.id);
            const pct = percentage(Number(summary?.attended ?? 0), Number(summary?.classes_held ?? 0));
            return (
              <Link
                key={course.id}
                href={`/student/courses/${course.id}`}
                className="group rounded-xl border bg-card p-5 shadow-card transition-colors hover:border-brand-300"
              >
                <div className="flex items-start justify-between">
                  <Badge variant="muted" className="font-mono">{course.code}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-3 font-display text-base font-semibold">{course.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {course.department?.name ?? "No department"} · {course.credit_units} units
                </p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {summary?.attended ?? 0} of {summary?.classes_held ?? 0} classes
                  </span>
                  <Badge variant={attendanceTone(pct)}>{formatPercent(pct, 0)}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No registered courses"
          description="Your institution administrator registers you for courses. They will appear here once added."
          action={
            <Button asChild variant="outline">
              <Link href="/student">Back to dashboard</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
