import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export default async function LecturerCoursesPage() {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("course_lecturers")
    .select("course:courses(id, code, title, credit_units, level, department:departments(name))")
    .eq("lecturer_id", ctx.user.id);

  const courses = (assignments ?? [])
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

  const ids = courses.map((course) => course.id);
  const [{ data: registrations }, { data: sessions }] = await Promise.all([
    ids.length
      ? supabase.from("course_registrations").select("course_id").in("course_id", ids).eq("status", "registered")
      : Promise.resolve({ data: [] as { course_id: string }[] }),
    ids.length
      ? supabase.from("attendance_sessions").select("course_id").in("course_id", ids).eq("status", "closed")
      : Promise.resolve({ data: [] as { course_id: string }[] }),
  ]);

  const studentCounts = new Map<string, number>();
  (registrations ?? []).forEach((row) => studentCounts.set(row.course_id, (studentCounts.get(row.course_id) ?? 0) + 1));
  const sessionCounts = new Map<string, number>();
  (sessions ?? []).forEach((row) => sessionCounts.set(row.course_id, (sessionCounts.get(row.course_id) ?? 0) + 1));

  return (
    <div className="page-shell">
      <PageHeader
        title="My courses"
        description="Courses assigned to you by your institution administrator. Assignment is required to start attendance."
        actions={
          <Button asChild>
            <Link href="/lecturer/attendance/new">Start attendance</Link>
          </Button>
        }
      />

      {courses.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/lecturer/courses/${course.id}`}
              className="group rounded-xl border bg-card p-5 shadow-card transition-colors hover:border-brand-300"
            >
              <div className="flex items-start justify-between">
                <Badge variant="muted" className="font-mono">{course.code}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-3 font-display text-base font-semibold">{course.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {course.department?.name ?? "No department"}
                {course.level ? ` · Level ${course.level}` : ""} · {course.credit_units} units
              </p>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{formatNumber(studentCounts.get(course.id) ?? 0)}</strong> students
                </span>
                <span>
                  <strong className="text-foreground">{sessionCounts.get(course.id) ?? 0}</strong> sessions held
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No courses assigned"
          description="Your institution administrator must assign you to a course before you can take attendance."
        />
      )}
    </div>
  );
}
