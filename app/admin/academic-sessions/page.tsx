import { CalendarRange, CheckCircle2, Pencil, Plus } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { EntityDialog, type FieldDef } from "@/components/admin/entity-dialog";
import { RowAction } from "@/components/admin/row-actions";
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
import { deleteAcademicSession, saveAcademicSession, setCurrentAcademicSession } from "@/lib/actions/admin";
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

type SessionRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

export default async function AcademicSessionsPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: sessions }, { data: semesters }] = await Promise.all([
    supabase
      .from("academic_sessions")
      .select("id, name, start_date, end_date, is_current")
      .eq("institution_id", institutionId)
      .order("start_date", { ascending: false }),
    supabase.from("semesters").select("id, academic_session_id").eq("institution_id", institutionId),
  ]);

  const counts = new Map<string, number>();
  (semesters ?? []).forEach((row) => {
    counts.set(row.academic_session_id, (counts.get(row.academic_session_id) ?? 0) + 1);
  });

  function fieldsFor(session?: SessionRow): FieldDef[] {
    return [
      { name: "name", label: "Session name", required: true, defaultValue: session?.name, placeholder: "2025/2026", full: true },
      { name: "start_date", label: "Start date", type: "date", required: true, defaultValue: session?.start_date },
      { name: "end_date", label: "End date", type: "date", required: true, defaultValue: session?.end_date },
    ];
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Academic sessions"
        description="Sessions group semesters and course registrations. Set one session as current for the whole institution."
        actions={
          <EntityDialog
            triggerLabel="Add session"
            triggerIcon={<Plus />}
            title="Add an academic session"
            fields={fieldsFor()}
            action={saveAcademicSession}
          />
        }
      />

      {sessions && sessions.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Semesters</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">{session.name}</TableCell>
                  <TableCell className="text-sm">{formatDate(session.start_date)}</TableCell>
                  <TableCell className="text-sm">{formatDate(session.end_date)}</TableCell>
                  <TableCell className="text-sm">{counts.get(session.id) ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={session.is_current ? "success" : "muted"}>
                      {session.is_current ? "Current" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {!session.is_current && (
                        <RowAction
                          action={setCurrentAcademicSession}
                          id={session.id}
                          label="Set as current"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                        />
                      )}
                      <EntityDialog
                        triggerLabel="Edit"
                        triggerIcon={<Pencil />}
                        triggerVariant="ghost"
                        triggerSize="icon-sm"
                        title="Edit session"
                        fields={fieldsFor(session)}
                        hiddenValues={{ id: session.id }}
                        action={saveAcademicSession}
                      />
                      <DeleteButton
                        action={deleteAcademicSession}
                        id={session.id}
                        title="Delete academic session?"
                        description="Semesters and registrations in this session will be unlinked from it, but not deleted."
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
          icon={CalendarRange}
          title="No academic sessions yet"
          description="Create a session such as 2025/2026, then add its semesters."
        />
      )}
    </div>
  );
}
