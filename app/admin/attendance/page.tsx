import Link from "next/link";
import { ScanLine } from "lucide-react";

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
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPercent, percentage } from "@/lib/utils";

const STATUSES = ["all", "open", "scheduled", "paused", "closed", "cancelled"] as const;

const badgeFor: Record<string, "success" | "info" | "warning" | "secondary" | "destructive"> = {
  open: "success",
  scheduled: "info",
  paused: "warning",
  closed: "secondary",
  cancelled: "destructive",
};

type PageProps = { searchParams: Promise<{ status?: string }> };

export default async function AdminAttendancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const status = STATUSES.includes((params.status ?? "all") as (typeof STATUSES)[number])
    ? params.status ?? "all"
    : "all";

  let query = supabase
    .from("attendance_sessions")
    .select(
      "id, title, class_date, opens_at, closes_at, status, location, course:courses(code, title), lecturer:profiles!attendance_sessions_lecturer_id_fkey(full_name)"
    )
    .eq("institution_id", institutionId)
    .order("class_date", { ascending: false })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const { data: sessions } = await query;
  const ids = (sessions ?? []).map((session) => session.id);
  const { data: summaries } = ids.length
    ? await supabase
        .from("session_attendance_summary")
        .select("session_id, registered_count, present_count")
        .in("session_id", ids)
    : { data: [] as { session_id: string; registered_count: number; present_count: number }[] };

  const summaryMap = new Map((summaries ?? []).map((row) => [row.session_id, row]));

  return (
    <div className="page-shell">
      <PageHeader
        title="Attendance sessions"
        description="Every attendance session taken by lecturers in your institution. Open a session to see the roster and correct records with an audit trail."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((item) => (
          <Link
            key={item}
            href={item === "all" ? "/admin/attendance" : `/admin/attendance?status=${item}`}
            className={
              item === status
                ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold capitalize text-primary-foreground"
                : "rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium capitalize text-muted-foreground hover:text-foreground"
            }
          >
            {item}
          </Link>
        ))}
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Lecturer</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const course = session.course as unknown as { code: string; title: string } | null;
                const lecturer = session.lecturer as unknown as { full_name: string } | null;
                const summary = summaryMap.get(session.id);
                const registered = Number(summary?.registered_count ?? 0);
                const present = Number(summary?.present_count ?? 0);
                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Link href={`/admin/attendance/${session.id}`} className="font-medium hover:text-brand-600">
                        {session.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{session.class_date}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-xs text-muted-foreground">{course?.code}</p>
                      <p className="text-sm">{course?.title}</p>
                    </TableCell>
                    <TableCell className="text-sm">{lecturer?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(session.opens_at)}
                      <br />
                      {formatDateTime(session.closes_at)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {present} / {registered}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatPercent(percentage(present, registered))}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeFor[session.status] ?? "secondary"} className="capitalize">
                        {session.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={ScanLine}
          title="No attendance sessions found"
          description="Lecturers start attendance from their dashboard. Sessions appear here as soon as they are created."
        />
      )}
    </div>
  );
}
