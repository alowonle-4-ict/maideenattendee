import Link from "next/link";
import { BarChart3, BookOpen, CalendarCheck2, CalendarX2, Clock3, Percent } from "lucide-react";

import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attendanceTone, formatPercent, percentage } from "@/lib/utils";

export default async function StudentStatsPage() {
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();

  const [{ data: summaries }, { data: settings }] = await Promise.all([
    supabase
      .from("student_course_attendance")
      .select("course_id, course_code, course_title, classes_held, attended, late_count")
      .eq("student_id", ctx.user.id)
      .order("course_code"),
    ctx.institutionId
      ? supabase
          .from("institution_settings")
          .select("attendance_threshold")
          .eq("institution_id", ctx.institutionId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const threshold = settings?.attendance_threshold ?? 75;
  const rows = (summaries ?? []).map((row) => {
    const held = Number(row.classes_held ?? 0);
    const attended = Number(row.attended ?? 0);
    return {
      ...row,
      held,
      attended,
      late: Number(row.late_count ?? 0),
      missed: Math.max(held - attended, 0),
      pct: percentage(attended, held),
    };
  });

  const held = rows.reduce((sum, row) => sum + row.held, 0);
  const attended = rows.reduce((sum, row) => sum + row.attended, 0);
  const late = rows.reduce((sum, row) => sum + row.late, 0);
  const missed = Math.max(held - attended, 0);
  const rate = percentage(attended, held);
  const atRisk = rows.filter((row) => row.held > 0 && row.pct < threshold);
  const best = [...rows].filter((row) => row.held > 0).sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="page-shell">
      <PageHeader
        title="Attendance statistics"
        description={`Attendance is calculated from sessions that have been opened or closed. Your institution requires ${threshold}% attendance.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/student/attendance">Full history</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Courses" value={rows.length} icon={BookOpen} tone="brand" />
        <StatCard label="Classes held" value={held} icon={CalendarCheck2} />
        <StatCard label="Attended" value={attended} icon={BarChart3} tone="success" />
        <StatCard label="Missed" value={missed} icon={CalendarX2} tone={missed ? "destructive" : "default"} />
        <StatCard
          label="Overall"
          value={formatPercent(rate)}
          icon={Percent}
          tone={attendanceTone(rate)}
          hint={rate >= threshold ? "Meeting requirement" : "Below requirement"}
        />
      </div>

      {held > 0 && (
        <div className="mt-6 rounded-xl border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Overall attendance</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {late} late arrival{late === 1 ? "" : "s"}
            </div>
          </div>
          <Progress value={Math.min(rate, 100)} className="mt-3 h-2" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {attended} of {held} classes attended
              {best ? ` · Best: ${best.course_code} (${formatPercent(best.pct, 0)})` : ""}
            </span>
            <Badge variant={attendanceTone(rate)}>{formatPercent(rate, 0)}</Badge>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Per-course breakdown"
          description="A course is marked at risk when attendance falls below the requirement."
        >
          {rows.length > 0 ? (
            <div className="space-y-5">
              {rows.map((row) => (
                <div key={row.course_id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{row.course_code}</p>
                      <Link
                        href={`/student/courses/${row.course_id}`}
                        className="text-sm font-medium hover:text-brand-600"
                      >
                        {row.course_title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {row.attended}/{row.held} classes
                      </span>
                      <Badge variant={attendanceTone(row.pct)}>{formatPercent(row.pct, 0)}</Badge>
                    </div>
                  </div>
                  <Progress value={Math.min(row.pct, 100)} className="mt-2 h-1.5" />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {row.held === 0
                      ? "No classes held yet"
                      : row.missed === 0
                        ? "No classes missed"
                        : `${row.missed} missed${row.late ? ` · ${row.late} late` : ""}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No course data"
              description="Register for courses to see attendance statistics."
            />
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Requirement status">
            <p className="stat-value">{formatPercent(rate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Requirement: {threshold}%
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Courses on track</span>
                <span className="font-medium">{rows.length - atRisk.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Courses at risk</span>
                <Badge variant={atRisk.length ? "destructive" : "success"}>
                  {atRisk.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Late arrivals</span>
                <span className="font-medium">{late}</span>
              </div>
            </div>
            {atRisk.length > 0 && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {atRisk.map((row) => row.course_code).join(", ")} below the {threshold}% requirement.
              </div>
            )}
          </SectionCard>

          <SectionCard title="How it is calculated">
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Only sessions marked open or closed count as classes held.</li>
              <li>• Present, late and excused scans count as attended.</li>
              <li>• Sessions you were not scanned for count as missed.</li>
              <li>• Corrections by an administrator update your statistics automatically.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
