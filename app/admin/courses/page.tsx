import { BookOpen, Pencil, Plus } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { EntityDialog, type FieldDef } from "@/components/admin/entity-dialog";
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
import { deleteCourse, saveCourse } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type CourseRow = {
  id: string;
  code: string;
  title: string;
  credit_units: number;
  level: string | null;
  department_id: string | null;
  semester_id: string | null;
  description: string | null;
};

export default async function CoursesPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: courses }, { data: departments }, { data: semesters }, { data: assignments }, { data: registrations }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("id, code, title, credit_units, level, department_id, semester_id, description, department:departments(name, code), semester:semesters(name)")
        .eq("institution_id", institutionId)
        .order("code"),
      supabase.from("departments").select("id, name, code").eq("institution_id", institutionId).order("name"),
      supabase
        .from("semesters")
        .select("id, name, is_current, academic_session:academic_sessions(name)")
        .eq("institution_id", institutionId)
        .order("name"),
      supabase.from("course_lecturers").select("course_id").eq("institution_id", institutionId),
      supabase.from("course_registrations").select("course_id").eq("institution_id", institutionId).eq("status", "registered"),
    ]);

  const lecturerCounts = new Map<string, number>();
  (assignments ?? []).forEach((row) => {
    lecturerCounts.set(row.course_id, (lecturerCounts.get(row.course_id) ?? 0) + 1);
  });
  const studentCounts = new Map<string, number>();
  (registrations ?? []).forEach((row) => {
    studentCounts.set(row.course_id, (studentCounts.get(row.course_id) ?? 0) + 1);
  });

  const departmentOptions = [
    { value: "none", label: "No department" },
    ...(departments ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
  ];
  const semesterOptions = [
    { value: "none", label: "No semester" },
    ...(semesters ?? []).map((s) => {
      const session = s.academic_session as unknown as { name: string } | null;
      return { value: s.id, label: `${s.name}${session ? ` — ${session.name}` : ""}${s.is_current ? " (current)" : ""}` };
    }),
  ];

  function fieldsFor(course?: CourseRow): FieldDef[] {
    return [
      { name: "code", label: "Course code", required: true, defaultValue: course?.code, placeholder: "CSC 301" },
      { name: "title", label: "Course title", required: true, defaultValue: course?.title, placeholder: "Data Structures" },
      { name: "department_id", label: "Department", type: "select", options: departmentOptions, defaultValue: course?.department_id ?? "none" },
      { name: "semester_id", label: "Semester", type: "select", options: semesterOptions, defaultValue: course?.semester_id ?? "none" },
      { name: "credit_units", label: "Credit units", type: "number", required: true, defaultValue: course?.credit_units ?? 3, min: 1, max: 12 },
      { name: "level", label: "Level", defaultValue: course?.level ?? "", placeholder: "300" },
      { name: "description", label: "Description", type: "textarea", defaultValue: course?.description ?? "", full: true },
    ];
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Courses"
        description="Create the courses you offer, then assign lecturers and register students. Plan limits apply to course creation."
        actions={
          <EntityDialog
            triggerLabel="Add course"
            triggerIcon={<Plus />}
            title="Add a course"
            fields={fieldsFor()}
            action={saveCourse}
            submitLabel="Create course"
          />
        }
      />

      {courses && courses.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Lecturers</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => {
                const department = course.department as unknown as { name: string; code: string } | null;
                const semester = course.semester as unknown as { name: string } | null;
                return (
                  <TableRow key={course.id}>
                    <TableCell>
                      <p className="font-mono text-xs text-muted-foreground">{course.code}</p>
                      <p className="font-medium">{course.title}</p>
                      {course.level && <p className="text-xs text-muted-foreground">Level {course.level}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{department?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{semester?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{course.credit_units}</TableCell>
                    <TableCell>
                      <Badge variant={lecturerCounts.get(course.id) ? "secondary" : "warning"}>
                        {lecturerCounts.get(course.id) ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{studentCounts.get(course.id) ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <EntityDialog
                          triggerLabel="Edit"
                          triggerIcon={<Pencil />}
                          triggerVariant="ghost"
                          triggerSize="icon-sm"
                          title="Edit course"
                          fields={fieldsFor(course)}
                          hiddenValues={{ id: course.id }}
                          action={saveCourse}
                        />
                        <DeleteButton
                          action={deleteCourse}
                          id={course.id}
                          title="Delete course?"
                          description="This permanently deletes the course, its attendance sessions and registrations. Attendance records for this course are also removed. This cannot be undone."
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Create your first course to start assigning lecturers and registering students."
        />
      )}
    </div>
  );
}
