import { Network, Pencil, Plus } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { EntityDialog } from "@/components/admin/entity-dialog";
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
import { deleteDepartment, saveDepartment } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DepartmentsPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: departments }, { data: faculties }, { data: profiles }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, code, faculty_id, faculty:faculties(name, code)")
      .eq("institution_id", institutionId)
      .order("name"),
    supabase.from("faculties").select("id, name, code").eq("institution_id", institutionId).order("name"),
    supabase.from("profiles").select("department_id").eq("institution_id", institutionId).not("department_id", "is", null),
  ]);

  const counts = new Map<string, number>();
  (profiles ?? []).forEach((row) => {
    if (row.department_id) counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
  });

  const facultyOptions = [
    { value: "none", label: "No faculty" },
    ...(faculties ?? []).map((f) => ({ value: f.id, label: `${f.name} (${f.code})` })),
  ];

  return (
    <div className="page-shell">
      <PageHeader
        title="Departments"
        description="Departments are linked to faculties and group students, lecturers and courses."
        actions={
          <EntityDialog
            triggerLabel="Add department"
            triggerIcon={<Plus />}
            title="Add a department"
            fields={[
              { name: "name", label: "Department name", required: true, placeholder: "Computer Science", full: true },
              { name: "code", label: "Department code", required: true, placeholder: "CSC" },
              { name: "faculty_id", label: "Faculty", type: "select", options: facultyOptions, full: true },
            ]}
            action={saveDepartment}
          />
        }
      />

      {departments && departments.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>People</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department) => {
                const faculty = department.faculty as unknown as { name: string; code: string } | null;
                return (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">{department.name}</TableCell>
                    <TableCell>
                      <Badge variant="muted" className="font-mono">{department.code}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{faculty?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{counts.get(department.id) ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <EntityDialog
                          triggerLabel="Edit"
                          triggerIcon={<Pencil />}
                          triggerVariant="ghost"
                          triggerSize="icon-sm"
                          title="Edit department"
                          fields={[
                            { name: "name", label: "Department name", required: true, defaultValue: department.name, full: true },
                            { name: "code", label: "Department code", required: true, defaultValue: department.code },
                            { name: "faculty_id", label: "Faculty", type: "select", options: facultyOptions, defaultValue: department.faculty_id ?? "none", full: true },
                          ]}
                          hiddenValues={{ id: department.id }}
                          action={saveDepartment}
                        />
                        <DeleteButton
                          action={deleteDepartment}
                          id={department.id}
                          title="Delete department?"
                          description="Profiles and courses linked to this department will be kept but unlinked."
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
          icon={Network}
          title="No departments yet"
          description="Create departments to organise students and courses. You can create them without a faculty and link them later."
        />
      )}
    </div>
  );
}
