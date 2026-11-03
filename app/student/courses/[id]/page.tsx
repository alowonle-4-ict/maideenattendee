import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarCheck2, Clock3, Percent, QrCode } from "lucide-react";

import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/dashboard/page-header";
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
  isUuid,
  percentage,
} from "@/lib/utils";

const recordBadge: Record<string, "success" | "warning" | "info" | "destructive"> = {
  present: "success",
  late: "warning",
  excused: "info",
  absent: "destructive",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function StudentCourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireAuth(["student"]);
  if (!isUuid(id)) notFound();

  const supabase = await createClient();

  const { data: registration } = await supabase
    .from("course_registrations")
    .select(
      "id, semester:semesters(name), course:courses(id, code, title, description, credit_units, level, department:departments(name))"
    )
    .eq("student_id", ctx.user.id)
    .eq("course_id", id)
    .eq("status", "registered")
    .maybeSingle();

  if (!registration) notFound();

  const course = registration.course as unknown as {
    id: string;
    code: string;
    title: string;
    description: string | null;
    credit_units: number;
    level: string | null;
    department: { name: string } | null;
  };
  const semester = registration.semester as unknown as { name: string } | null;

  const [{ data: sessions }, { data: records }, { data: summary }, { data: settings }] =
    await Promise.all([
      supabase
        .from("attendance_sessions")
        .select(
          "id, title, class_date, status, opens_at, closes_at, location, lecturer:profiles!attendance_sessions_lecturer_id_fkey(full_name)"
        )
        .eq("course_id", id)
        .order("class_date", { ascending: false }),
      supabase
        .from("attendance_records")
        .select("attendance_session_id, status, scanned_at, sync_source")
        .eq("student_id", ctx.user.id)
        .eq("course_id", id),
      supabase
        .from("student_course_attendance")
        .select("classes_held, attended, late_count")
        .eq("student_id", ctx.user.id)
        .eq("course_id", id)
        .maybeSingle(),
      ctx.institutionId
        ? supabase
            .from("institution_settings")
            .select("attendance_threshold")
            .eq("institution_id", ctx.institutionId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const recordMap = new Map((records ?? []).map((row) => [row.attendance_session_id, row]));
  const threshold = settings?.attendance_threshold ?? 75;
  const held = Number(summary?.classes_held ?? 0);
  const attended = Number(summary?.attended ?? 0);
  const late = Number(summary?.late_count ?? 0);
  const missed = Math.max(held - attended, 0);
  const rate = percentage(attended, held);
  const lecturerNames = Array.from(
    new Set(
      (sessions ?? [])
        .map((session) => (session.lecturer as unknown as { full_name: string } | null)?.full_name)
        .filter((name): name is string => Boolean(name))
    )
  ).join(", ");

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={course.code}
        title={course.title}
        description={course.description ?? "Your attendance history for this course."}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/student/courses">
                <ArrowLeft /> All courses
              </Link>
            </Button>
            <Button asChild>
              <Link href="/student/qr">
                <QrCode /> My QR code
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes held" value={held} icon={CalendarCheck2} />
        <StatCard label="Attended" value={attended} icon={CalendarCheck2} tone="success" />
        <StatCard label="Late arrivals" value={late} icon={Clock3} tone={late > 0 ? "warning" : "default"} />
        <StatCard
          label="Attendance"
          value={formatPercent(rate)}
          icon={Percent}
          tone={attendanceTone(rate)}
          hint={rate >= threshold ? "Above requirement" : `Below ${threshold}% requirement`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Attendance progress"
          description={`Requirement for this institution is ${threshold}%.`}
        >
          <Progress value={Math.min(rate, 100)} className="h-2" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {attended} attended · {missed} missed · {held} classes
            </span>
            <Badge variant={attendanceTone(rate)}>{formatPercent(rate, 0)}</Badge>
          </div>
        </SectionCard>

        <SectionCard title="Course details">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Course code</dt>
              <dd className="font-mono text-xs">{course.code}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Credit units</dt>
              <dd>{course.credit_units}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Level</dt>
              <dd>{course.level ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Department</dt>
              <dd className="text-right">{course.department?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Semester</dt>
              <dd className="text-right">{semester?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Lecturer</dt>
              <dd className="text-right">{lecturerNames || "—"}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Class sessions"
          description="Every session your lecturer has scheduled or held for this course."
          contentClassName="p-0"
        >
          {sessions && sessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Your attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const record = recordMap.get(session.id);
                  const lecturer = session.lecturer as unknown as { full_name: string } | null;
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(session.class_date)}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.location ?? "No location"}
                          {lecturer?.full_name ? ` · ${lecturer.full_name}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.status === "open"
                              ? "success"
                              : session.status === "closed"
                                ? "muted"
                                : session.status === "cancelled"
                                  ? "destructive"
                                  : "info"
                          }
                          className="capitalize"
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={recordBadge[record.status] ?? "secondary"} className="capitalize">
                              {record.status}
                            </Badge>
                            {record.sync_source === "offline" && (
                              <Badge variant="warning">Offline</Badge>
                            )}
                          </div>
                        ) : session.status === "closed" ? (
                          <Badge variant="destructive">Missed</Badge>
                        ) : (
                          <Badge variant="muted">Not scanned</Badge>
                        )}
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
                title="No class sessions yet"
                description="Sessions appear here as soon as your lecturer schedules them."
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
