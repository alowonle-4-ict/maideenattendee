import Link from "next/link";
import { GraduationCap, Pencil, Plus, Search, Users } from "lucide-react";

import { ImportStudentsDialog } from "@/components/admin/import-students-dialog";
import { EntityDialog, type FieldDef } from "@/components/admin/entity-dialog";
import { QrCredentialDialog, RowAction, ToggleActiveButton } from "@/components/admin/row-actions";
import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveStudent } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, initials } from "@/lib/utils";

const PAGE_SIZE = 25;

type PageProps = { searchParams: Promise<{ q?: string; page?: string }> };

type StudentRow = {
  id: string;
  full_name: string;
  matric_number: string | null;
  phone: string | null;
  department_id: string | null;
};

export default async function StudentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const q = (params.q ?? "").replace(/[%,()]/g, " ").trim();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, matric_number, phone, is_active, created_at, department_id, department:departments(name, code)", {
      count: "exact",
    })
    .eq("institution_id", institutionId)
    .not("matric_number", "is", null)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (q) query = query.or(`full_name.ilike.%${q}%,matric_number.ilike.%${q}%,email.ilike.%${q}%`);

  const [{ data: students, count }, { data: departments }, { data: institution }] = await Promise.all([
    query,
    supabase
      .from("departments")
      .select("id, name, code")
      .eq("institution_id", institutionId)
      .order("name"),
    supabase.from("institutions").select("name").eq("id", institutionId).maybeSingle(),
  ]);

  const ids = (students ?? []).map((s) => s.id);
  const { data: credentials } = ids.length
    ? await supabase
        .from("student_qr_credentials")
        .select("student_id, token, status")
        .in("student_id", ids)
    : { data: [] as { student_id: string; token: string; status: string }[] };
  const tokenMap = new Map((credentials ?? []).map((c) => [c.student_id, c]));

  const departmentOptions = [
    { value: "none", label: "No department" },
    ...(departments ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
  ];

  function fieldsFor(student?: StudentRow): FieldDef[] {
    return [
      { name: "full_name", label: "Full name", required: true, defaultValue: student?.full_name, full: true },
      { name: "matric_number", label: "Matric number", required: true, defaultValue: student?.matric_number ?? "", placeholder: "2023/CSC/001" },
      { name: "phone", label: "Phone", defaultValue: student?.phone ?? "", placeholder: "08030000000" },
      {
        name: "department_id",
        label: "Department",
        type: "select",
        options: departmentOptions,
        defaultValue: student?.department_id ?? "none",
      },
      ...(!student
        ? ([
            {
              name: "email",
              label: "Email (optional)",
              type: "email",
              placeholder: "student@example.com",
              help: "Leave blank to generate a sign-in email automatically.",
            },
            {
              name: "password",
              label: "Temporary password (optional)",
              type: "password",
              help: "Leave blank to generate a strong password. It is shown once after creation.",
            },
          ] as FieldDef[])
        : []),
    ];
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-shell">
      <PageHeader
        title="Students"
        description="Create student accounts, issue permanent QR credentials, and manage access. Each student's QR code is unique and contains no personal data."
        actions={
          <>
            <ImportStudentsDialog />
            <EntityDialog
              triggerLabel="Add student"
              triggerIcon={<Plus />}
              title="Add a student"
              description="A permanent QR credential is generated automatically. Sign-in details are shown once."
              fields={fieldsFor()}
              action={saveStudent}
              submitLabel="Create student"
            />
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/students">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search name, matric number or email" className="pl-9" />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {total.toLocaleString()} student{total === 1 ? "" : "s"}
        </div>
      </form>

      {students && students.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Matric no.</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>QR credential</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const credential = tokenMap.get(student.id);
                const department = student.department as unknown as { name: string; code: string } | null;
                return (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          {initials(student.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{student.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{student.matric_number}</TableCell>
                    <TableCell className="text-sm">{department?.name ?? "—"}</TableCell>
                    <TableCell>
                      {credential ? (
                        <Badge variant={credential.status === "active" ? "success" : "destructive"} className="capitalize">
                          {credential.status}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Missing</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.is_active ? "secondary" : "destructive"}>
                        {student.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(student.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <QrCredentialDialog
                          student={{ id: student.id, name: student.full_name, matric: student.matric_number }}
                          token={credential?.token ?? null}
                          institutionName={institution?.name ?? "Institution"}
                        />
                        <EntityDialog
                          triggerLabel="Edit"
                          triggerIcon={<Pencil />}
                          triggerVariant="ghost"
                          triggerSize="icon-sm"
                          title="Edit student"
                          fields={fieldsFor(student)}
                          hiddenValues={{ id: student.id }}
                          action={saveStudent}
                        />
                        <ToggleActiveButton id={student.id} active={student.is_active} kind="student" />
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
          icon={GraduationCap}
          title={q ? "No students match your search" : "No students yet"}
          description={
            q
              ? "Try a different name, matric number or email address."
              : "Add students individually or import an Excel/CSV file. Every student receives a permanent QR credential."
          }
        />
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        <Users className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Student QR codes are opaque random tokens. They contain no name, matric number or other
          personal data, and they are validated on the server on every scan. Regenerating a code
          immediately revokes the previous one.
        </p>
      </div>
    </div>
  );
}
