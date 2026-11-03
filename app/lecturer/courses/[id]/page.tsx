import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileBarChart, FileSpreadsheet, ScanLine } from "lucide-react";

import { PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
import { ImportCourseStudentsDialog } from "@/components/lecturer/import-course-students-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attendanceTone, formatDate, formatPercent, percentage } from "@/lib/utils";

const badgeFor: Record<string, "success" | "info" | "warning" | "secondary" | "destructive"> = {
  open: "success",
  scheduled: "info",
  paused: "warning",
  closed: "secondary",
  cancelled: "destructive",
};

export default async function LecturerCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("course_lecturers")
    .select("id")
    .eq("course_id", id)
    .eq("lecturer_id", ctx.user.id)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: course } = await supabase
    .from("courses")
    .select("id, code, title, credit_units, level, description, department:departments(name), semester:semesters(name)")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  const [{ data: registrations }, { data: sessions }] = await Promise.all([
    supabase
      .from("course_registrations")
      .select("student_id, registered_at, student:profiles!course_registrations_student_id_fkey(full_name, matric_number)")
      .eq("course_id", id)
      .eq("status", "registered"),
    supabase
      .from("attendance_sessions")
      .select("id, title, class_date, status, opens_at, closes_at")
      .eq("course_id", id)
      .eq("lecturer_id", ctx.user.id)
      .order("class_date", { ascending: false }),
  ]);

  const studentIds = (registrations ?? []).map((row) => row.student_id);
  const { data: summaries } = studentIds.length
    ? await supabase
        .from("student_course_attendance")
        .select("student_id, classes_held, attended, late_count")
        .eq("course_id", id)
        .in("student_id", studentIds)
    : { data: [] as { student_id: string; classes_held: number; attended: number; late_count: number }[] };

  const summaryMap = new Map((summaries ?? []).map((row) => [row.student_id, row]));
  const department = course.department as unknown as { name: string } | null;
  const semester = course.semester as unknown as { name: string } | null;
  const held = (summaries ?? [])[0] ? Number((summaries ?? [])[0].classes_held) : (sessions ?? []).filter((s) => s.status === "closed" || s.status === "open").length;
  const totalAttended = (summaries ?? []).reduce((sum, row) => sum + Number(row.attended ?? 0), 0);
  const rate = percentage(totalAttended, held * studentIds.length);

  return (
    <div className="page-shell">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/lecturer/courses">
          <ArrowLeft /> My courses
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${course.code} · ${semester?.name ?? "No semester"}`}
        title={course.title}
        description={`${department?.name ?? "No department"} · ${course.credit_units} units${course.level ? ` · Level ${course.level}` : ""}`}
        actions={
          <>
            <ImportCourseStudentsDialog courseId={id} courseCode={course.code} />
            <Button asChild variant="outline">
              <a href={`/api/exports/course/${id}?type=register`}>
                <FileSpreadsheet /> Register
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/exports/course/${id}?type=summary`}>
                <FileBarChart /> Summary
              </a>
            </Button>
            <Button asChild>
              <Link href="/lecturer/attendance/new">
                <ScanLine /> Start attendance
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered students" value={studentIds.length} hint="Can be scanned for this course" />
        <StatCard label="Sessions held" value={held} tone="brand" />
        <StatCard label="Attendance rate" value={formatPercent(rate)} tone={attendanceTone(rate)} hint="Across all held sessions" />
        <StatCard label="Exports" value="XLSX" hint="Register and summary formats" icon={Download} />
      </div>

      {course.description && (
        <div className="mt-6 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">{course.description}</div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Student roster" description="Attendance figures update as records are confirmed." contentClassName="p-0">
          {registrations && registrations.length > 0 ? (
            <div className="max-h-[32rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Matric</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead>%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration) => {
                    const student = registration.student as unknown as { full_name: string; matric_number: string | null } | null;
                    const summary = summaryMap.get(registration.student_id);
                    const pct = percentage(Number(summary?.attended ?? 0), Number(summary?.classes_held ?? 0));
                    return (
                      <TableRow key={registration.student_id}>
                        <TableCell className="font-medium">{student?.full_name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{student?.matric_number ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {summary?.attended ?? 0} / {summary?.classes_held ?? 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant={attendanceTone(pct)}>{formatPercent(pct, 0)}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              No students registered for this course yet.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Attendance sessions" description="Only sessions you created are shown." contentClassName="p-0">
          {sessions && sessions.length > 0 ? (
            <div className="max-h-[32rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell className="text-sm">{formatDate(session.class_date)}</TableCell>
                      <TableCell>
                        <Badge variant={badgeFor[session.status] ?? "secondary"} className="capitalize">
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/lecturer/scan/${session.id}`}>
                              {["open", "paused", "scheduled"].includes(session.status) ? "Scan" : "View"}
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No sessions for this course yet.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
