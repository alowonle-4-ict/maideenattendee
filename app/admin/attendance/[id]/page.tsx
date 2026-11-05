import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, Wifi } from "lucide-react";

import { CorrectAttendanceDialog } from "@/components/attendance/correct-attendance-dialog";
import { LiveRefresh } from "@/components/attendance/live-refresh";
import { SessionControls } from "@/components/attendance/session-controls";
import { PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
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
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";
import { formatDateTime, formatPercent, formatTime, percentage } from "@/lib/utils";

type RosterRow = {
  student_id: string;
  full_name: string;
  matric_number: string | null;
  present: boolean;
  scanned_at: string | null;
  attendance_status: AttendanceStatus | null;
};

const statusBadge: Record<string, "success" | "warning" | "info" | "destructive" | "secondary"> = {
  present: "success",
  late: "warning",
  excused: "info",
  absent: "destructive",
};

export default async function AdminSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select(
      "id, title, class_date, opens_at, closes_at, status, location, notes, course:courses(code, title), lecturer:profiles!attendance_sessions_lecturer_id_fkey(full_name)"
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!session) notFound();

  const [{ data: rosterData }, { data: records }] = await Promise.all([
    supabase.rpc("get_session_roster", { p_session_id: id }),
    supabase
      .from("attendance_records")
      .select(
        "id, student_id, status, method, scanned_at, sync_source, created_at, student:profiles!attendance_records_student_id_fkey(full_name, matric_number)"
      )
      .eq("attendance_session_id", id)
      .order("scanned_at"),
  ]);

  const roster = ((rosterData as { roster?: RosterRow[] } | null)?.roster ?? [])
    .slice()
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const registered = roster.length;
  const present = roster.filter((row) => row.present).length;
  const absent = registered - present;
  const rate = percentage(present, registered);
  const course = session.course as unknown as { code: string; title: string } | null;
  const lecturer = session.lecturer as unknown as { full_name: string } | null;

  const recordIds = (records ?? []).map((record) => record.id);
  const { data: auditRows } = recordIds.length
    ? await supabase
        .from("attendance_audit_logs")
        .select("id, action, reason, created_at, previous_state, new_state, actor:profiles!attendance_audit_logs_actor_id_fkey(full_name)")
        .in("attendance_record_id", recordIds)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; action: string; reason: string | null; created_at: string; previous_state: unknown; new_state: unknown; actor: unknown }[] };



  return (
    <div className="page-shell">
      {["open", "scheduled", "paused"].includes(session.status) && <LiveRefresh sessionId={id} />}
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/admin/attendance">
          <ArrowLeft /> All sessions
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${course?.code ?? ""} · ${lecturer?.full_name ?? ""}`}
        title={session.title}
        description={`${formatDateTime(session.opens_at)} → ${formatDateTime(session.closes_at)}${
          session.location ? ` · ${session.location}` : ""
        }`}
        actions={<SessionControls sessionId={id} status={session.status} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered" value={registered} hint="Students expected in this class" />
        <StatCard label="Present" value={present} tone="success" hint="Including late and excused" />
        <StatCard label="Absent" value={absent} tone="destructive" hint="Registered but not scanned" />
        <StatCard
          label="Attendance rate"
          value={formatPercent(rate)}
          tone="brand"
          hint={`${formatPercent(rate)} of the roster was marked`}
        />
      </div>

      {session.notes && (
        <div className="mb-6 rounded-xl border bg-muted/30 p-4 text-sm">
          <span className="font-medium">Notes: </span>
          <span className="text-muted-foreground">{session.notes}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Roster"
          description="Server-side roster computed from course registrations. Corrections are audited."
          contentClassName="p-0"
        >
          {roster.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Matric</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time scanned</TableHead>
                  <TableHead className="text-right">Correct</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((row) => {
                  const record = (records ?? []).find((item) => item.student_id === row.student_id);
                  return (
                    <TableRow key={row.student_id}>
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.matric_number ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge[row.attendance_status ?? "absent"] ?? "secondary"} className="capitalize">
                          {row.attendance_status ?? "absent"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.scanned_at ? formatTime(row.scanned_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {record ? (
                            <CorrectAttendanceDialog
                              recordId={record.id}
                              currentStatus={record.status as AttendanceStatus}
                              studentName={row.full_name}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">No record</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              No students are registered for this course. Register students before attendance can be taken.
            </p>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Session details">
            <dl className="space-y-3 text-sm">
              <Detail label="Course" value={`${course?.code ?? ""} — ${course?.title ?? ""}`} />
              <Detail label="Lecturer" value={lecturer?.full_name ?? "—"} />
              <Detail label="Class date" value={session.class_date} />
              <Detail label="Status" value={session.status} />
              <Detail label="Location" value={session.location ?? "—"} />
              <Detail label="Student records" value={`${records?.length ?? 0}`} />
            </dl>
          </SectionCard>

          <SectionCard title="Scan sources" description="How records arrived.">
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Wifi className="h-3.5 w-3.5" /> Online scans
                </span>
                <span className="font-medium">
                  {(records ?? []).filter((record) => record.sync_source === "online").length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Offline synchronised
                </span>
                <span className="font-medium">
                  {(records ?? []).filter((record) => record.sync_source === "offline").length}
                </span>
              </li>
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Offline records are validated by the server on replay: the scan time must fall inside the
              official window, and replay is only accepted within 24 hours.
            </p>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6">
        <SectionCard title="Correction audit trail" description="Only corrections made within this session are shown.">
          {auditRows && auditRows.length > 0 ? (
            <ul className="divide-y">
              {auditRows.map((entry) => {
                const actor = entry.actor as unknown as { full_name: string } | null;
                return (
                  <li key={entry.id} className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {entry.action.replace(/_/g, " ")} · {actor?.full_name ?? "Unknown actor"}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                    </div>
                    {entry.reason && <p className="text-xs text-muted-foreground">{entry.reason}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No corrections have been made for this session.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium capitalize">{value}</dd>
    </div>
  );
}
