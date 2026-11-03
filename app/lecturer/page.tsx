import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ScanLine,
  Users,
} from "lucide-react";

import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
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
import {
  attendanceTone,
  formatDate,
  formatPercent,
  formatTime,
  percentage,
} from "@/lib/utils";

const badgeFor: Record<string, "success" | "info" | "warning" | "secondary" | "destructive"> = {
  open: "success",
  scheduled: "info",
  paused: "warning",
  closed: "secondary",
  cancelled: "destructive",
};

export default async function LecturerOverviewPage() {
  const ctx = await requireAuth(["lecturer"]);
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("course_lecturers")
    .select("course_id, course:courses(id, code, title, credit_units)")
    .eq("lecturer_id", ctx.user.id);

  const courseIds = (assignments ?? []).map((row) => row.course_id);
  const courses = (assignments ?? [])
    .map((row) => row.course as unknown as { id: string; code: string; title: string; credit_units: number } | null)
    .filter((course): course is NonNullable<typeof course> => course !== null);

  const [
    { count: registeredStudents },
    { count: activeSessions },
    { count: completedSessions },
    { data: summaryRows },
    { data: recentSessions },
  ] = await Promise.all([
    courseIds.length
      ? supabase
          .from("course_registrations")
          .select("*", { count: "exact", head: true })
          .in("course_id", courseIds)
          .eq("status", "registered")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("lecturer_id", ctx.user.id)
      .in("status", ["open", "paused"]),
    supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("lecturer_id", ctx.user.id)
      .eq("status", "closed"),
    supabase
      .from("session_attendance_summary")
      .select("registered_count, present_count")
      .eq("lecturer_id", ctx.user.id),
    supabase
      .from("attendance_sessions")
      .select("id, title, class_date, opens_at, closes_at, status, course:courses(code, title)")
      .eq("lecturer_id", ctx.user.id)
      .order("class_date", { ascending: false })
      .limit(6),
  ]);

  const expected = (summaryRows ?? []).reduce((sum, row) => sum + Number(row.registered_count ?? 0), 0);
  const present = (summaryRows ?? []).reduce((sum, row) => sum + Number(row.present_count ?? 0), 0);
  const rate = percentage(present, expected);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={`Welcome${ctx.profile?.full_name ? `, ${ctx.profile.full_name.split(" ")[0]}` : ""}`}
        title="Teaching overview"
        description="Take attendance by scanning students' QR codes. You can only start attendance for courses assigned to you."
        actions={
          <Button asChild>
            <Link href="/lecturer/attendance/new">
              <ScanLine /> Start attendance
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assigned courses" value={courses.length} icon={BookOpen} tone="brand" />
        <StatCard label="Registered students" value={registeredStudents ?? 0} icon={Users} hint="Across your courses" />
        <StatCard label="Active sessions" value={activeSessions ?? 0} icon={ScanLine} tone="warning" hint="Open or paused" />
        <StatCard
          label="Attendance rate"
          value={formatPercent(rate)}
          icon={CalendarClock}
          tone={attendanceTone(rate)}
          hint={`${present} of ${expected} expected`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Recent sessions"
          description={`${completedSessions ?? 0} completed session${(completedSessions ?? 0) === 1 ? "" : "s"}.`}
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/lecturer/history">
                History <ArrowRight />
              </Link>
            </Button>
          }
          contentClassName="p-0"
        >
          {recentSessions && recentSessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSessions.map((session) => {
                  const course = session.course as unknown as { code: string; title: string } | null;
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell className="font-mono text-xs">{course?.code}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(session.class_date)}
                        <span className="block text-xs text-muted-foreground">{formatTime(session.opens_at)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeFor[session.status] ?? "secondary"} className="capitalize">
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={
                                ["open", "paused", "scheduled"].includes(session.status)
                                  ? `/lecturer/scan/${session.id}`
                                  : `/lecturer/history?session=${session.id}`
                              }
                            >
                              {["open", "paused"].includes(session.status) ? "Scan" : "View"}
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={ScanLine}
                title="No attendance sessions yet"
                description="Start your first session to scan student QR codes. The roster is downloaded automatically for offline use."
                action={
                  <Button asChild>
                    <Link href="/lecturer/attendance/new">Start attendance</Link>
                  </Button>
                }
              />
            </div>
          )}
        </SectionCard>

        <SectionCard title="My courses" description="Only these courses are available in the scanner.">
          {courses.length > 0 ? (
            <ul className="space-y-2.5">
              {courses.slice(0, 6).map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/lecturer/courses/${course.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-brand-300 hover:bg-muted/40"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] text-muted-foreground">{course.code}</span>
                      <span className="block truncate font-medium">{course.title}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No courses assigned yet. Ask your institution administrator to assign you to a course.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
