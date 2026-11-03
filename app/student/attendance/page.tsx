import Link from "next/link";
import { CalendarCheck2, CalendarX2, Percent, ScanLine } from "lucide-react";

import { EmptyState, PageHeader, StatCard } from "@/components/dashboard/page-header";
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
  isUuid,
  percentage,
} from "@/lib/utils";

const PAGE_SIZE = 25;
const STATUSES = ["present", "late", "excused", "absent"] as const;

const statusBadge: Record<string, "success" | "warning" | "info" | "destructive"> = {
  present: "success",
  late: "warning",
  excused: "info",
  absent: "destructive",
};

type PageProps = {
  searchParams: Promise<{ course?: string; status?: string; page?: string }>;
};

export default async function StudentAttendancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();

  const courseFilter = isUuid(params.course ?? "") ? params.course : undefined;
  const statusFilter = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  function href(overrides: Record<string, string | undefined>) {
    const merged = {
      course: courseFilter,
      status: statusFilter,
      ...overrides,
    };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return query ? `/student/attendance?${query}` : "/student/attendance";
  }

  let query = supabase
    .from("attendance_records")
    .select(
      "id, status, method, scanned_at, sync_source, course_id, session:attendance_sessions(id, title, class_date), course:courses(id, code, title)",
      { count: "exact" }
    )
    .eq("student_id", ctx.user.id)
    .order("scanned_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (courseFilter) query = query.eq("course_id", courseFilter);
  if (statusFilter) query = query.eq("status", statusFilter);

  const [{ data: records, count }, { data: registrations }, { data: summaries }] =
    await Promise.all([
      query,
      supabase
        .from("course_registrations")
        .select("course:courses(id, code, title)")
        .eq("student_id", ctx.user.id)
        .eq("status", "registered"),
      supabase
        .from("student_course_attendance")
        .select("classes_held, attended")
        .eq("student_id", ctx.user.id),
    ]);

  const courses = (registrations ?? [])
    .map(
      (row) =>
        row.course as unknown as { id: string; code: string; title: string } | null
    )
    .filter((course): course is NonNullable<typeof course> => course !== null);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const held = (summaries ?? []).reduce((sum, row) => sum + Number(row.classes_held ?? 0), 0);
  const attended = (summaries ?? []).reduce((sum, row) => sum + Number(row.attended ?? 0), 0);
  const rate = percentage(attended, held);

  return (
    <div className="page-shell">
      <PageHeader
        title="Attendance history"
        description="Every confirmed scan for your registered courses. Records captured offline are marked and verified when your lecturer's device synchronizes."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Classes held" value={held} icon={CalendarCheck2} />
        <StatCard label="Attended" value={attended} icon={ScanLine} tone="success" />
        <StatCard
          label="Missed"
          value={Math.max(held - attended, 0)}
          icon={CalendarX2}
          tone={held - attended > 0 ? "destructive" : "default"}
        />
        <StatCard label="Attendance" value={formatPercent(rate)} icon={Percent} tone={attendanceTone(rate)} />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <Button asChild size="sm" variant={!statusFilter ? "default" : "outline"}>
            <Link href={href({ status: undefined, page: undefined })}>All</Link>
          </Button>
          {STATUSES.map((status) => (
            <Button
              key={status}
              asChild
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
            >
              <Link href={href({ status, page: undefined })} className="capitalize">
                {status}
              </Link>
            </Button>
          ))}

          <form method="get" className="ml-auto flex items-center gap-2">
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <select
              name="course"
              defaultValue={courseFilter ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              aria-label="Filter by course"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">
              Filter
            </Button>
            {(courseFilter || statusFilter) && (
              <Button asChild size="sm" variant="ghost">
                <Link href="/student/attendance">Clear</Link>
              </Button>
            )}
          </form>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-card">
        {records && records.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Recorded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const course = record.course as unknown as { code: string; title: string } | null;
                const session = record.session as unknown as {
                  title: string;
                  class_date: string;
                } | null;
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <p className="font-mono text-xs text-muted-foreground">{course?.code}</p>
                      <p className="text-sm">{course?.title}</p>
                    </TableCell>
                    <TableCell className="text-sm">{session?.title ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(session?.class_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[record.status] ?? "secondary"} className="capitalize">
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted" className="capitalize">
                        {record.method}
                      </Badge>
                      {record.sync_source === "offline" && (
                        <Badge variant="warning" className="ml-1.5">
                          Offline
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatTime(record.scanned_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={CalendarCheck2}
              title="No attendance records"
              description={
                courseFilter || statusFilter
                  ? "No records match the selected filters."
                  : "Your attendance will appear here after your lecturer scans your QR code."
              }
              action={
                courseFilter || statusFilter ? (
                  <Button asChild variant="outline">
                    <Link href="/student/attendance">Clear filters</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/student/qr">Open my QR code</Link>
                  </Button>
                )
              }
            />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={href({ page: String(page - 1) })}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={href({ page: String(page + 1) })}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
