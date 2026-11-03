import Link from "next/link";
import { UserCheck, UserX } from "lucide-react";

import { AssignLecturerForm } from "@/components/admin/assign-lecturer-form";
import { RowAction } from "@/components/admin/row-actions";
import { EmptyState, PageHeader, SectionCard } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { unassignLecturer } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AssignmentsPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: courses }, { data: roleRows }, { data: assignments }] = await Promise.all([
    supabase.from("courses").select("id, code, title").eq("institution_id", institutionId).order("code"),
    supabase.from("user_roles").select("user_id").eq("institution_id", institutionId).eq("role", "lecturer"),
    supabase
      .from("course_lecturers")
      .select(
        "id, course_id, lecturer_id, created_at, course:courses(code, title), lecturer:profiles!course_lecturers_lecturer_id_fkey(full_name, email, staff_number)"
      )
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false }),
  ]);

  const lecturerIds = (roleRows ?? []).map((row) => row.user_id);
  const { data: lecturers } = lecturerIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, staff_number")
        .in("id", lecturerIds)
        .eq("is_active", true)
        .order("full_name")
    : { data: [] as { id: string; full_name: string; email: string; staff_number: string | null }[] };

  return (
    <div className="page-shell">
      <PageHeader
        title="Course assignments"
        description="Only assigned lecturers can start attendance for a course. The restriction is enforced inside the database, not just in the interface."
      />

      <SectionCard title="Assign a lecturer" description="Choose the course and the lecturer who teaches it.">
        <AssignLecturerForm
          courses={(courses ?? []).map((course) => ({ id: course.id, label: `${course.code} — ${course.title}` }))}
          lecturers={(lecturers ?? []).map((lecturer) => ({
            id: lecturer.id,
            label: `${lecturer.full_name}${lecturer.staff_number ? ` (${lecturer.staff_number})` : ""}`,
          }))}
        />
      </SectionCard>

      <div className="mt-6">
        {assignments && assignments.length > 0 ? (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Lecturer</TableHead>
                  <TableHead>Staff no.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const course = assignment.course as unknown as { code: string; title: string } | null;
                  const lecturer = assignment.lecturer as unknown as { full_name: string; email: string; staff_number: string | null } | null;
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <p className="font-mono text-xs text-muted-foreground">{course?.code}</p>
                        <p className="font-medium">{course?.title}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{lecturer?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{lecturer?.email}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{lecturer?.staff_number ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="success">Assigned</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <RowAction
                            action={unassignLecturer}
                            id={assignment.id}
                            label="Remove assignment"
                            icon={<UserX className="h-4 w-4" />}
                            confirm={{
                              title: "Remove this assignment?",
                              description:
                                "The lecturer will immediately lose the ability to start attendance for this course. Existing attendance records are kept.",
                              confirmLabel: "Remove",
                              destructive: true,
                            }}
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
            icon={UserCheck}
            title="No course assignments yet"
            description="Assign at least one lecturer to a course so they can take attendance."
            action={
              (courses ?? []).length === 0 ? (
                <Link href="/admin/courses" className="text-sm font-medium text-brand-600 hover:underline">
                  Create a course first (or import students first)
                </Link>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
