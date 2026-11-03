import { Pencil, Plus, School } from "lucide-react";

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
import { deleteFaculty, saveFaculty } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function FacultiesPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: faculties }, { data: departments }] = await Promise.all([
    supabase.from("faculties").select("id, name, code, created_at").eq("institution_id", institutionId).order("name"),
    supabase.from("departments").select("id, faculty_id").eq("institution_id", institutionId),
  ]);

  const counts = new Map<string, number>();
  (departments ?? []).forEach((row) => {
    if (row.faculty_id) counts.set(row.faculty_id, (counts.get(row.faculty_id) ?? 0) + 1);
  });

  return (
    <div className="page-shell">
      <PageHeader
        title="Faculties"
        description="Faculties group your departments. Students and courses are linked through departments."
        actions={
          <EntityDialog
            triggerLabel="Add faculty"
            triggerIcon={<Plus />}
            title="Add a faculty"
            fields={[
              { name: "name", label: "Faculty name", required: true, placeholder: "Faculty of Science", full: true },
              { name: "code", label: "Faculty code", required: true, placeholder: "SCI" },
            ]}
            action={saveFaculty}
          />
        }
      />

      {faculties && faculties.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faculty</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faculties.map((faculty) => (
                <TableRow key={faculty.id}>
                  <TableCell className="font-medium">{faculty.name}</TableCell>
                  <TableCell>
                    <Badge variant="muted" className="font-mono">{faculty.code}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{counts.get(faculty.id) ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(faculty.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <EntityDialog
                        triggerLabel="Edit"
                        triggerIcon={<Pencil />}
                        triggerVariant="ghost"
                        triggerSize="icon-sm"
                        title="Edit faculty"
                        fields={[
                          { name: "name", label: "Faculty name", required: true, defaultValue: faculty.name, full: true },
                          { name: "code", label: "Faculty code", required: true, defaultValue: faculty.code },
                        ]}
                        hiddenValues={{ id: faculty.id }}
                        action={saveFaculty}
                      />
                      <DeleteButton
                        action={deleteFaculty}
                        id={faculty.id}
                        title="Delete faculty?"
                        description="Departments in this faculty will be kept, but they will no longer be linked to a faculty."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={School}
          title="No faculties yet"
          description="Start by creating a faculty, then add departments beneath it."
        />
      )}
    </div>
  );
}
