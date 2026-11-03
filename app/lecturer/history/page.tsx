import Link from "next/link";
import { FileSpreadsheet, FileText, History } from "lucide-react";

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
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPercent, formatTime, percentage } from "@/lib/utils";

const badgeFor: Record<string, "success" | "info" | "warning" | "secondary" | "destructive"> = {
  open: "success",
  scheduled: "info",
  paused: "warning",
  closed: "secondary",
  cancelled: "destructive",
};

export default async function LecturerHistoryPage() {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id, title, class_date, opens_at, closes_at, status, course:courses(code, title)")
    .eq("lecturer_id", ctx.user.id)
    .order("class_date", { ascending: false })
    .limit(100);

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
        title="Attendance history"
        description="Every session you have created. Open a session to view the roster and export individual class attendance."
        actions={
          <Button asChild>
            <Link href="/lecturer/attendance/new">Start attendance</Link>
          </Button>
        }
      />

      {sessions && sessions.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const course = session.course as unknown as { code: string; title: string } | null;
                const summary = summaryMap.get(session.id);
                const registered = Number(summary?.registered_count ?? 0);
                const present = Number(summary?.present_count ?? 0);
                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.title}</TableCell>
                    <TableCell>
                      <p className="font-mono text-xs text-muted-foreground">{course?.code}</p>
                      <p className="text-sm">{course?.title}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(session.class_date)}
                      <span className="block text-xs text-muted-foreground">
                        {formatTime(session.opens_at)} → {formatTime(session.closes_at)}
                      </span>
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
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/exports/session/${session.id}`}>
                            <FileSpreadsheet /> Excel
                          </a>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/exports/session/${session.id}?format=pdf`}>
                            <FileText /> PDF
                          </a>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/lecturer/scan/${session.id}`}>
                            {["open", "paused", "scheduled"].includes(session.status) ? "Scan" : "View"}
                          </Link>
                        </Button>
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
          icon={History}
          title="No sessions yet"
          description="Attendance sessions you create will appear here with their live counts."
          action={
            <Button asChild>
              <Link href="/lecturer/attendance/new">Start attendance</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
