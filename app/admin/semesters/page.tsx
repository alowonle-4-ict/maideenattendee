import Link from "next/link";
import { CalendarDays, CheckCircle2, Pencil, Plus } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { EntityDialog, type FieldDef } from "@/components/admin/entity-dialog";
import { RowAction } from "@/components/admin/row-actions";
import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
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
import { deleteSemester, saveSemester, setCurrentSemester } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

type SemesterRow = {
  id: string;
  name: string;
  academic_session_id: string;
  start_date: string | null;
  end_date: string | null;
};

export default async function SemestersPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: semesters }, { data: sessions }] = await Promise.all([
    supabase
      .from("semesters")
      .select("id, name, academic_session_id, start_date, end_date, is_current, academic_session:academic_sessions(name)")
      .eq("institution_id", institutionId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("academic_sessions")
      .select("id, name")
      .eq("institution_id", institutionId)
      .order("start_date", { ascending: false }),
  ]);

  const sessionOptions = (sessions ?? []).map((session) => ({ value: session.id, label: session.name }));

  function fieldsFor(semester?: SemesterRow): FieldDef[] {
    return [
      { name: "academic_session_id", label: "Academic session", type: "select", required: true, options: sessionOptions, defaultValue: semester?.academic_session_id, full: true },
      { name: "name", label: "Semester name", required: true, defaultValue: semester?.name, placeholder: "First Semester", full: true },
      { name: "start_date", label: "Start date", type: "date", defaultValue: semester?.start_date ?? "" },
      { name: "end_date", label: "End date", type: "date", defaultValue: semester?.end_date ?? "" },
    ];
  }

  const addButton =
    sessionOptions.length > 0 ? (
      <EntityDialog
        triggerLabel="Add semester"
        triggerIcon={<Plus />}
        title="Add a semester"
        fields={fieldsFor()}
        action={saveSemester}
      />
    ) : (
      <Button asChild variant="outline">
        <Link href="/admin/academic-sessions">Create a session first</Link>
      </Button>
    );

  return (
    <div className="page-shell">
      <PageHeader
        title="Semesters"
        description="Semesters belong to academic sessions. The current semester is used as the default when creating courses and sessions."
        actions={addButton}
      />

      {semesters && semesters.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semester</TableHead>
                <TableHead>Academic session</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semesters.map((semester) => {
                const session = semester.academic_session as unknown as { name: string } | null;
                return (
                  <TableRow key={semester.id}>
                    <TableCell className="font-medium">{semester.name}</TableCell>
                    <TableCell className="text-sm">{session?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {semester.start_date ? `${formatDate(semester.start_date)} → ${formatDate(semester.end_date)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={semester.is_current ? "success" : "muted"}>
                        {semester.is_current ? "Current" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {!semester.is_current && (
                          <RowAction
                            action={setCurrentSemester}
                            id={semester.id}
                            label="Set as current"
                            icon={<CheckCircle2 className="h-4 w-4" />}
                          />
                        )}
                        <EntityDialog
                          triggerLabel="Edit"
                          triggerIcon={<Pencil />}
                          triggerVariant="ghost"
                          triggerSize="icon-sm"
                          title="Edit semester"
                          fields={fieldsFor(semester)}
                          hiddenValues={{ id: semester.id }}
                          action={saveSemester}
                        />
                        <DeleteButton
                          action={deleteSemester}
                          id={semester.id}
                          title="Delete semester?"
                          description="Courses linked to this semester will be kept but unlinked."
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
          icon={CalendarDays}
          title="No semesters yet"
          description="Create an academic session first, then add its semesters."
        />
      )}
    </div>
  );
}
