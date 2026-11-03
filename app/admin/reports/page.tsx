import Link from "next/link";
import { Download, FileBarChart, FileSpreadsheet, FileText } from "lucide-react";

import { PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
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
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attendanceTone, formatNumber, formatPercent, percentage } from "@/lib/utils";

export default async function ReportsPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: rows }, { data: courses }, { data: settings }, { count: sessionCount }] = await Promise.all([
    supabase
      .from("student_course_attendance")
      .select("course_id, course_code, course_title, student_id, classes_held, attended")
      .eq("institution_id", institutionId),
    supabase.from("courses").select("id, code, title").eq("institution_id", institutionId).order("code"),
    supabase.from("institution_settings").select("attendance_threshold").eq("institution_id", institutionId).maybeSingle(),
    supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .in("status", ["open", "closed"]),
  ]);

  const threshold = settings?.attendance_threshold ?? 75;

  const courseAgg = new Map<
    string,
    { code: string; title: string; students: number; held: number; attended: number }
  >();
  const studentAgg = new Map<string, { held: number; attended: number }>();

  (rows ?? []).forEach((row) => {
    const course = courseAgg.get(row.course_id) ?? {
      code: row.course_code,
      title: row.course_title,
      students: 0,
      held: 0,
      attended: 0,
    };
    course.students += 1;
    course.held += Number(row.classes_held ?? 0);
    course.attended += Number(row.attended ?? 0);
    courseAgg.set(row.course_id, course);

    const student = studentAgg.get(row.student_id) ?? { held: 0, attended: 0 };
    student.held += Number(row.classes_held ?? 0);
    student.attended += Number(row.attended ?? 0);
    studentAgg.set(row.student_id, student);
  });

  const totalHeld = Array.from(courseAgg.values()).reduce((sum, course) => sum + course.held, 0);
  const totalAttended = Array.from(courseAgg.values()).reduce((sum, course) => sum + course.attended, 0);
  const overallRate = percentage(totalAttended, totalHeld);
  const atRisk = Array.from(studentAgg.values()).filter(
    (student) => student.held > 0 && percentage(student.attended, student.held) < threshold
  ).length;

  const courseRows = (courses ?? []).map((course) => {
    const agg = courseAgg.get(course.id);
    return {
      ...course,
      students: agg?.students ?? 0,
      held: agg?.held ?? 0,
      attended: agg?.attended ?? 0,
      rate: percentage(agg?.attended ?? 0, agg?.held ?? 0),
    };
  });

  return (
    <div className="page-shell">
      <PageHeader
        title="Reports and analytics"
        description="Attendance is computed from confirmed records only. Excel and PDF exports include the institution, course, lecturer, session and semester header."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/api/exports/institution?format=pdf">
                <FileText /> Export PDF
              </a>
            </Button>
            <Button asChild>
              <a href="/api/exports/institution">
                <Download /> Export Excel
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall attendance" value={formatPercent(overallRate)} tone={attendanceTone(overallRate)} hint={`Threshold: ${threshold}%`} />
        <StatCard label="Expected attendances" value={formatNumber(totalHeld)} hint="Registrations × sessions held" />
        <StatCard label="Confirmed attendances" value={formatNumber(totalAttended)} tone="success" hint="Present, late or excused" />
        <StatCard label="Students below threshold" value={formatNumber(atRisk)} tone="destructive" hint={`Below ${threshold}% overall`} />
      </div>

      <div className="mt-6">
        <SectionCard
          title="Course performance"
          description={`${formatNumber(sessionCount ?? 0)} completed or open sessions across ${courseRows.length} courses.`}
          contentClassName="p-0"
        >
          {courseRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseRows.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <p className="font-mono text-xs text-muted-foreground">{course.code}</p>
                      <p className="font-medium">{course.title}</p>
                    </TableCell>
                    <TableCell>{course.students}</TableCell>
                    <TableCell>{course.held}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={attendanceTone(course.rate)}>{formatPercent(course.rate)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {course.attended} / {course.held}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/exports/course/${course.id}?type=register`} title="Complete course register">
                            <FileSpreadsheet /> Register
                          </a>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/exports/course/${course.id}?type=summary`} title="Student attendance summary">
                            <FileBarChart /> Summary
                          </a>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/exports/course/${course.id}?format=pdf&type=summary`} title="PDF attendance summary">
                            <FileText /> PDF
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">
              No courses yet. Create courses and register students to build reports.{" "}
              <Link href="/admin/courses" className="font-medium text-brand-600 hover:underline">
                Go to courses
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Individual class attendance exports are available from each attendance session page.
      </p>
    </div>
  );
}
