import { Users } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
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
import { attendanceTone, formatPercent, percentage } from "@/lib/utils";

export default async function LecturerStudentsPage() {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("course_lecturers")
    .select("course:courses(id, code)")
    .eq("lecturer_id", ctx.user.id);

  const courses = (assignments ?? [])
    .map((row) => row.course as unknown as { id: string; code: string } | null)
    .filter((course): course is NonNullable<typeof course> => course !== null);
  const ids = courses.map((course) => course.id);
  const codeById = new Map(courses.map((course) => [course.id, course.code]));

  const [{ data: registrations }, { data: summaries }] = await Promise.all([
    ids.length
      ? supabase
          .from("course_registrations")
          .select(
            "course_id, student_id, student:profiles!course_registrations_student_id_fkey(full_name, matric_number, department:departments(name))"
          )
          .in("course_id", ids)
          .eq("status", "registered")
      : Promise.resolve({
          data: [] as {
            course_id: string;
            student_id: string;
            student: { full_name: string; matric_number: string | null; department: { name: string } | null } | null;
          }[],
        }),
    ids.length
      ? supabase
          .from("student_course_attendance")
          .select("student_id, course_id, classes_held, attended")
          .in("course_id", ids)
      : Promise.resolve({ data: [] as { student_id: string; course_id: string; classes_held: number; attended: number }[] }),
  ]);

  const summaryMap = new Map(
    (summaries ?? []).map((row) => [`${row.course_id}:${row.student_id}`, row])
  );

  type Entry = {
    student_id: string;
    name: string;
    matric: string | null;
    department: string | null;
    courses: string[];
    held: number;
    attended: number;
  };
  type RegistrationRow = {
    course_id: string;
    student_id: string;
    student: {
      full_name: string;
      matric_number: string | null;
      department: { name: string } | null;
    } | null;
  };
  const students = new Map<string, Entry>();
  ((registrations ?? []) as unknown as RegistrationRow[]).forEach((row) => {
    const profile = row.student;
    const entry: Entry = students.get(row.student_id) ?? {
      student_id: row.student_id,
      name: profile?.full_name ?? "Unknown",
      matric: profile?.matric_number ?? null,
      department: profile?.department?.name ?? null,
      courses: [],
      held: 0,
      attended: 0,
    };
    entry.courses.push(codeById.get(row.course_id) ?? "");
    const summary = summaryMap.get(`${row.course_id}:${row.student_id}`);
    entry.held += Number(summary?.classes_held ?? 0);
    entry.attended += Number(summary?.attended ?? 0);
    students.set(row.student_id, entry);
  });

  const rows = Array.from(students.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page-shell">
      <PageHeader
        title="My students"
        description="Students registered in the courses assigned to you. Attendance figures cover only those courses."
      />

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Matric</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Attended</TableHead>
                <TableHead>Overall</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((student) => {
                const pct = percentage(student.attended, student.held);
                return (
                  <TableRow key={student.student_id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell className="font-mono text-xs">{student.matric ?? "—"}</TableCell>
                    <TableCell className="text-sm">{student.department ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{student.courses.filter(Boolean).join(", ")}</TableCell>
                    <TableCell className="text-sm">
                      {student.attended} / {student.held}
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
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Students appear here once they are registered for one of your assigned courses."
        />
      )}
    </div>
  );
}
