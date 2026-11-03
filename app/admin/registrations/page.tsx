import Link from "next/link";
import { ClipboardList, UserMinus } from "lucide-react";

import { RegisterStudentsForm } from "@/components/admin/register-students-form";
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
import { removeRegistration } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

type PageProps = { searchParams: Promise<{ course?: string }> };

export default async function RegistrationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: courses }, { data: currentSession }, { data: students }] = await Promise.all([
    supabase.from("courses").select("id, code, title").eq("institution_id", institutionId).order("code"),
    supabase
      .from("academic_sessions")
      .select("id, name")
      .eq("institution_id", institutionId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, matric_number, department:departments(name)")
      .eq("institution_id", institutionId)
      .not("matric_number", "is", null)
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const selectedCourse = (courses ?? []).find((course) => course.id === params.course) ?? null;

  const { data: registrations } = selectedCourse
    ? await supabase
        .from("course_registrations")
        .select(
          "id, registered_at, status, academic_session_id, student:profiles!course_registrations_student_id_fkey(id, full_name, matric_number, department:departments(name))"
        )
        .eq("institution_id", institutionId)
        .eq("course_id", selectedCourse.id)
        .eq("status", "registered")
        .order("registered_at")
    : {
        data: [] as {
          id: string;
          registered_at: string;
          status: string;
          academic_session_id: string | null;
          student: unknown;
        }[],
      };

  const registeredIds = new Set(
    (registrations ?? []).map((row) => {
      const student = row.student as unknown as { id?: string } | null;
      return student?.id ?? "";
    })
  );

  const courseOptions = courses ?? [];
  const availableStudents = (students ?? []).filter((student) => !registeredIds.has(student.id));

  return (
    <div className="page-shell">
      <PageHeader
        title="Course registrations"
        description="Register students for the courses they take. Only registered students can be marked present when their QR code is scanned."
      />

      {courseOptions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No courses yet"
          description="Create a course before registering students."
          action={
            <Link href="/admin/courses" className="text-sm font-medium text-brand-600 hover:underline">
              Go to courses
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {courseOptions.map((course) => (
              <Link
                key={course.id}
                href={`/admin/registrations?course=${course.id}`}
                className={
                  course.id === selectedCourse?.id
                    ? "rounded-full border border-primary bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                }
              >
                {course.code}
              </Link>
            ))}
          </div>

          {selectedCourse ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title={`Registered — ${selectedCourse.code}`}
                description={`${registrations?.length ?? 0} student${(registrations?.length ?? 0) === 1 ? "" : "s"} registered${currentSession ? ` · ${currentSession.name}` : ""}`}
                contentClassName="p-0"
              >
                {registrations && registrations.length > 0 ? (
                  <div className="max-h-[32rem] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Matric</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead className="text-right">Remove</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrations.map((registration) => {
                          const student = registration.student as unknown as {
                            full_name: string;
                            matric_number: string;
                            department: { name: string } | null;
                          } | null;
                          return (
                            <TableRow key={registration.id}>
                              <TableCell>
                                <p className="font-medium">{student?.full_name ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">{student?.department?.name ?? ""}</p>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{student?.matric_number}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDate(registration.registered_at)}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end">
                                  <RowAction
                                    action={removeRegistration}
                                    id={registration.id}
                                    label="Remove registration"
                                    icon={<UserMinus className="h-4 w-4" />}
                                    confirm={{
                                      title: "Remove this registration?",
                                      description:
                                        "The student will no longer be expected in this course. Past attendance records are preserved.",
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
                  <div className="p-5">
                    <PointerHint>No students registered for this course yet.</PointerHint>
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Add students"
                description={currentSession ? `Registrations are recorded against ${currentSession.name}.` : "No current academic session is set. Set one for cleaner reporting."}
              >
                <RegisterStudentsForm
                  courseId={selectedCourse.id}
                  academicSessionId={currentSession?.id ?? null}
                  students={availableStudents.map((student) => ({
                    id: student.id,
                    name: student.full_name,
                    matric: student.matric_number ?? "",
                    department: (student.department as unknown as { name: string } | null)?.name ?? null,
                  }))}
                />
              </SectionCard>
            </div>
          ) : (
            <PointerHint>
              <Badge variant="muted" className="mr-2">Tip</Badge>
              Select a course above to see its roster and register students.
            </PointerHint>
          )}
        </>
      )}
    </div>
  );
}

function PointerHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
