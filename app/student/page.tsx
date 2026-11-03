import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck2, CalendarX2, Percent, QrCode } from "lucide-react";

import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

const statusBadge: Record<string, "success" | "warning" | "info" | "destructive"> = {
  present: "success",
  late: "warning",
  excused: "info",
  absent: "destructive",
};

export default async function StudentOverviewPage() {
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();

  const [
    { data: registrations },
    { data: summaries },
    { data: recentRecords },
    { data: credential },
    { data: settings },
    { count: unread },
  ] = await Promise.all([
    supabase
      .from("course_registrations")
      .select("course_id, course:courses(id, code, title)")
      .eq("student_id", ctx.user.id)
      .eq("status", "registered"),
    supabase
      .from("student_course_attendance")
      .select("course_id, course_code, course_title, classes_held, attended, late_count")
      .eq("student_id", ctx.user.id),
    supabase
      .from("attendance_records")
      .select(
        "id, status, scanned_at, sync_source, session:attendance_sessions(title, class_date), course:courses(code, title)"
      )
      .eq("student_id", ctx.user.id)
      .order("scanned_at", { ascending: false })
      .limit(8),
    supabase
      .from("student_qr_credentials")
      .select("token, status")
      .eq("student_id", ctx.user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("institution_settings")
      .select("attendance_threshold")
      .eq("institution_id", ctx.institutionId!)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .is("read_at", null),
  ]);

  const threshold = settings?.attendance_threshold ?? 75;
  const courses = registrations ?? [];
  const held = (summaries ?? []).reduce((sum, row) => sum + Number(row.classes_held ?? 0), 0);
  const attended = (summaries ?? []).reduce((sum, row) => sum + Number(row.attended ?? 0), 0);
  const rate = percentage(attended, held);
  const missed = Math.max(held - attended, 0);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={`${ctx.profile?.matric_number ?? ""}`}
        title={`Hello${ctx.profile?.full_name ? `, ${ctx.profile.full_name.split(" ")[0]}` : ""}`}
        description="Your attendance is updated automatically when your lecturer scans your QR code. Show your QR code to your lecturer at the start of each class."
        actions={
          <Button asChild>
            <Link href="/student/qr">
              <QrCode /> My QR code
            </Link>
          </Button>
        }
      />

      {!credential && (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          Your QR credential is missing. Please contact your institution administrator to have it issued.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Courses" value={courses.length} icon={BookOpen} tone="brand" />
        <StatCard label="Classes held" value={held} icon={CalendarCheck2} hint="Across your courses" />
        <StatCard label="Attended" value={attended} icon={CalendarCheck2} tone="success" hint="Present, late or excused" />
        <StatCard label="Missed" value={missed} icon={CalendarX2} tone={missed > 0 ? "destructive" : "default"} />
        <StatCard
          label="Attendance"
          value={formatPercent(rate)}
          icon={Percent}
          tone={attendanceTone(rate)}
          hint={rate >= threshold ? "Above requirement" : `Below ${threshold}% requirement`}
        />
      </div>

      {held > 0 && (
        <div className="mt-6 rounded-xl border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Overall attendance</p>
            <p className="text-xs text-muted-foreground">
              {attended} of {held} classes · requirement {threshold}%
            </p>
          </div>
          <Progress value={Math.min(rate, 100)} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {rate >= threshold
              ? "You are meeting the attendance requirement."
              : `You are ${formatPercent(threshold - rate)} below the requirement. Attend upcoming classes to improve.`}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Course attendance"
          description="Attendance percentage per registered course."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/student/stats">
                Statistics <ArrowRight />
              </Link>
            </Button>
          }
          contentClassName="p-0"
        >
          {summaries && summaries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Held</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Missed</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((row) => {
                  const pct = percentage(Number(row.attended), Number(row.classes_held));
                  return (
                    <TableRow key={row.course_id}>
                      <TableCell>
                        <p className="font-mono text-xs text-muted-foreground">{row.course_code}</p>
                        <p className="font-medium">{row.course_title}</p>
                      </TableCell>
                      <TableCell>{row.classes_held}</TableCell>
                      <TableCell>{row.attended}</TableCell>
                      <TableCell>{Math.max(Number(row.classes_held) - Number(row.attended), 0)}</TableCell>
                      <TableCell>
                        <Badge variant={attendanceTone(pct)}>{formatPercent(pct, 0)}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={BookOpen}
                title="No courses registered"
                description="Once your institution registers you for courses, attendance appears here."
              />
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="My QR code"
            description="Permanent and unique to you."
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/student/qr">Open</Link>
              </Button>
            }
          >
            <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center">
              <QrCode className="mx-auto h-10 w-10 text-brand-600" />
              <p className="mt-3 text-sm font-medium">Present this code in class</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your lecturer scans it to mark you present. The code contains no personal information.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Notifications" description={unread ? `${unread} unread` : "You are all caught up."}>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/student/notifications">View notifications</Link>
            </Button>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Recent attendance"
          description="Latest scans confirmed by the server. Offline records show as provisional until synchronized."
          contentClassName="p-0"
        >
          {recentRecords && recentRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRecords.map((record) => {
                  const course = record.course as unknown as { code: string; title: string } | null;
                  const session = record.session as unknown as { title: string; class_date: string } | null;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <p className="font-mono text-xs text-muted-foreground">{course?.code}</p>
                        <p className="text-sm">{course?.title}</p>
                      </TableCell>
                      <TableCell className="text-sm">{session?.title ?? "—"}</TableCell>
                      <TableCell className="text-sm">{formatDate(session?.class_date)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge[record.status] ?? "secondary"} className="capitalize">
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(record.scanned_at)}
                        {record.sync_source === "offline" && (
                          <Badge variant="warning" className="ml-2">Offline</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No attendance recorded yet.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
