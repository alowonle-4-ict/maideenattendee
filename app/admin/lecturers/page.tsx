import { Pencil, Plus, Search, UserRound } from "lucide-react";

import { EntityDialog, type FieldDef } from "@/components/admin/entity-dialog";
import { ToggleActiveButton } from "@/components/admin/row-actions";
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
import { saveLecturer } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, initials } from "@/lib/utils";

type PageProps = { searchParams: Promise<{ q?: string }> };

type LecturerRow = {
  id: string;
  full_name: string;
  staff_number: string | null;
  phone: string | null;
  department_id: string | null;
};

export default async function LecturersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const q = (params.q ?? "").replace(/[%,()]/g, " ").trim();

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("institution_id", institutionId)
    .eq("role", "lecturer");

  const lecturerIds = (roleRows ?? []).map((row) => row.user_id);

  let lecturerQuery = supabase
    .from("profiles")
    .select(
      "id, full_name, email, staff_number, phone, is_active, created_at, department_id, department:departments(name, code)",
      { count: "exact" }
    )
    .eq("institution_id", institutionId)
    .in("id", lecturerIds.length ? lecturerIds : ["00000000-0000-0000-0000-000000000000"])
    .order("full_name")
    .limit(200);

  if (q) lecturerQuery = lecturerQuery.or(`full_name.ilike.%${q}%,staff_number.ilike.%${q}%,email.ilike.%${q}%`);

  const [{ data: lecturers, count }, { data: departments }, { data: assignments }] = await Promise.all([
    lecturerQuery,
    supabase.from("departments").select("id, name, code").eq("institution_id", institutionId).order("name"),
    lecturerIds.length
      ? supabase.from("course_lecturers").select("lecturer_id, course_id").eq("institution_id", institutionId).in("lecturer_id", lecturerIds)
      : Promise.resolve({ data: [] as { lecturer_id: string; course_id: string }[] }),
  ]);

  const courseCounts = new Map<string, number>();
  (assignments ?? []).forEach((row) => {
    courseCounts.set(row.lecturer_id, (courseCounts.get(row.lecturer_id) ?? 0) + 1);
  });

  const departmentOptions = [
    { value: "none", label: "No department" },
    ...(departments ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
  ];

  function fieldsFor(lecturer?: LecturerRow): FieldDef[] {
    return [
      { name: "full_name", label: "Full name", required: true, defaultValue: lecturer?.full_name, full: true },
      { name: "staff_number", label: "Staff number", defaultValue: lecturer?.staff_number ?? "", placeholder: "STAFF/001" },
      { name: "phone", label: "Phone", defaultValue: lecturer?.phone ?? "" },
      {
        name: "department_id",
        label: "Department",
        type: "select",
        options: departmentOptions,
        defaultValue: lecturer?.department_id ?? "none",
      },
      ...(!lecturer
        ? ([
            {
              name: "email",
              label: "Email (optional)",
              type: "email",
              placeholder: "lecturer@example.com",
              help: "Leave blank to generate a staff sign-in email automatically.",
            },
            {
              name: "password",
              label: "Temporary password (optional)",
              type: "password",
              help: "Leave blank to generate one. It is shown once after creation.",
            },
          ] as FieldDef[])
        : []),
    ];
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Lecturers"
        description="Lecturer accounts can only take attendance for courses you assign to them. Assignment is enforced by the database."
        actions={
          <EntityDialog
            triggerLabel="Add lecturer"
            triggerIcon={<Plus />}
            title="Add a lecturer"
            description="Sign-in details are displayed once after the account is created."
            fields={fieldsFor()}
            action={saveLecturer}
            submitLabel="Create lecturer"
          />
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/lecturers">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search name, staff number or email" className="pl-9" />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {(count ?? 0).toLocaleString()} lecturer{count === 1 ? "" : "s"}
        </div>
      </form>

      {lecturers && lecturers.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lecturer</TableHead>
                <TableHead>Staff no.</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lecturers.map((lecturer) => {
                const department = lecturer.department as unknown as { name: string; code: string } | null;
                return (
                  <TableRow key={lecturer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                          {initials(lecturer.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{lecturer.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{lecturer.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{lecturer.staff_number ?? "—"}</TableCell>
                    <TableCell className="text-sm">{department?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="muted">{courseCounts.get(lecturer.id) ?? 0} assigned</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lecturer.is_active ? "secondary" : "destructive"}>
                        {lecturer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(lecturer.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <EntityDialog
                          triggerLabel="Edit"
                          triggerIcon={<Pencil />}
                          triggerVariant="ghost"
                          triggerSize="icon-sm"
                          title="Edit lecturer"
                          fields={fieldsFor(lecturer)}
                          hiddenValues={{ id: lecturer.id }}
                          action={saveLecturer}
                        />
                        <ToggleActiveButton id={lecturer.id} active={lecturer.is_active} kind="lecturer" />
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
          icon={UserRound}
          title={q ? "No lecturers match your search" : "No lecturers yet"}
          description={
            q
              ? "Try a different name, staff number or email address."
              : "Create lecturer accounts, then assign each lecturer to the courses they teach."
          }
        />
      )}
    </div>
  );
}
