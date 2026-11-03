import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  ClipboardCheck,
  GraduationCap,
  ScanLine,
  UserRound,
  Users,
} from "lucide-react";

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
import { requireInstitution } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  attendanceTone,
  formatDate,
  formatNumber,
  formatPercent,
  percentage,
} from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive" | "info"> = {
  open: "success",
  scheduled: "info",
  closed: "secondary",
  cancelled: "destructive",
};

export default async function AdminOverviewPage() {
  const { institutionId, profile } = await requireInstitution();
  const supabase = await createClient();

  const [
    { data: institution },
    { data: subscription },
    { count: students },
    { count: lecturers },
    { count: courses },
    { count: sessions },
    { count: records },
    { count: facultyCount },
    { data: summaryRows },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from("institutions").select("name").eq("id", institutionId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, ends_at, trial_ends_at, plan:subscription_plans(name, price_ngn, max_students, max_lecturers, max_courses, billing_cycle)")
      .eq("institution_id", institutionId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .not("matric_number", "is", null),
    supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "lecturer"),
    supabase.from("courses").select("*", { count: "exact", head: true }).eq("institution_id", institutionId),
    supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId),
    supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId),
    supabase
      .from("faculties")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId),
    supabase
      .from("session_attendance_summary")
      .select("session_id, registered_count, present_count")
      .eq("institution_id", institutionId),
    supabase
      .from("attendance_sessions")
      .select(
        "id, title, class_date, status, course:courses(code, title), lecturer:profiles!attendance_sessions_lecturer_id_fkey(full_name)"
      )
      .eq("institution_id", institutionId)
      .order("class_date", { ascending: false })
      .limit(6),
  ]);

  const plan = subscription?.plan as unknown as
    | { name: string; price_ngn: number; max_students: number; max_lecturers: number; max_courses: number; billing_cycle: string }
    | null;

  const expected = (summaryRows ?? []).reduce((total, row) => total + Number(row.registered_count ?? 0), 0);
  const present = (summaryRows ?? []).reduce((total, row) => total + Number(row.present_count ?? 0), 0);
  const rate = percentage(present, expected);

  const onboarding = [
    { done: (facultyCount ?? 0) > 0, label: "Create your faculties and departments", href: "/admin/faculties" },
    { done: (courses ?? 0) > 0, label: "Add the courses you run", href: "/admin/courses" },
    { done: (lecturers ?? 0) > 0, label: "Create lecturer accounts", href: "/admin/lecturers" },
    { done: (students ?? 0) > 0, label: "Add or import your students", href: "/admin/students" },
    { done: (sessions ?? 0) > 0, label: "Take your first attendance session", href: "/admin/attendance" },
  ];
  const onboardingComplete = onboarding.every((step) => step.done);

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={institution?.name ?? "Institution"}
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        description="A live view of attendance across your institution. Data is scoped to your institution by database policy."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/reports">
                <ClipboardCheck /> Reports
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/students">
                <GraduationCap /> Manage students
              </Link>
            </Button>
          </>
        }
      />

      {subscription?.status === "trialing" && trialDaysLeft != null && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-900 dark:bg-brand-950/50 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-brand-900 dark:text-brand-100">
            <strong className="font-semibold">Trial active</strong> — {Math.max(trialDaysLeft, 0)} day
            {trialDaysLeft === 1 ? "" : "s"} left on the {plan?.name ?? "trial"} plan. All your data is preserved when the trial ends.
          </p>
          <Button asChild size="sm">
            <Link href="/admin/subscription">Choose a plan</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={formatNumber(students ?? 0)} icon={GraduationCap} tone="brand" hint={`${formatNumber(students ?? 0)} of ${formatNumber(plan?.max_students ?? 0)} plan seats`} />
        <StatCard label="Lecturers" value={formatNumber(lecturers ?? 0)} icon={UserRound} hint={`${formatNumber(lecturers ?? 0)} of ${formatNumber(plan?.max_lecturers ?? 0)} plan seats`} />
        <StatCard label="Courses" value={formatNumber(courses ?? 0)} icon={BookOpen} hint={`${formatNumber(plan?.max_courses ?? 0)} allowed on this plan`} />
        <StatCard
          label="Attendance rate"
          value={formatPercent(rate)}
          icon={CalendarCheck2}
          tone={attendanceTone(rate)}
          hint={`${formatNumber(present)} present of ${formatNumber(expected)} expected`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attendance sessions" value={formatNumber(sessions ?? 0)} icon={ScanLine} hint="Scheduled, open and completed" />
        <StatCard label="Attendance records" value={formatNumber(records ?? 0)} icon={Users} hint="Every confirmed scan" />
        <StatCard label="Faculties" value={formatNumber(facultyCount ?? 0)} icon={BookOpen} hint="Academic structure" />
        <StatCard label="Plan" value={plan?.name ?? "No plan"} icon={ClipboardCheck} tone="warning" hint={subscription?.status ? subscription.status.replace("_", " ") : "Contact support"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Recent attendance sessions"
          description="Ordered by class date. Open a session in Reports for per-student detail."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/attendance">
                View all <ArrowRight />
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
                  <TableHead>Lecturer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSessions.map((session) => {
                  const course = session.course as unknown as { code: string; title: string } | null;
                  const lecturer = session.lecturer as unknown as { full_name: string } | null;
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{course?.code ?? "—"}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{course?.title}</span>
                      </TableCell>
                      <TableCell className="text-sm">{lecturer?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{formatDate(session.class_date)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[session.status] ?? "secondary"} className="capitalize">
                          {session.status}
                        </Badge>
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
                description="Once lecturers start scanning student QR codes, sessions will appear here with live counts."
                action={
                  <Button asChild variant="outline">
                    <Link href="/admin/assignments">Assign lecturers to courses</Link>
                  </Button>
                }
              />
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title={onboardingComplete ? "Setup complete" : "Finish setting up"}
            description={onboardingComplete ? "Your institution is ready for attendance." : "Complete these steps to get accurate attendance."}
          >
            <ul className="space-y-3">
              {onboarding.map((step) => (
                <li key={step.label} className="flex items-start gap-3 text-sm">
                  <span
                    className={
                      step.done
                        ? "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                        : "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] text-muted-foreground"
                    }
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <Link
                    href={step.href}
                    className={step.done ? "text-muted-foreground line-through" : "hover:text-brand-600"}
                  >
                    {step.label}
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Plan usage" description={plan ? `${plan.name} — ₦${Number(plan.price_ngn).toLocaleString()} / ${plan.billing_cycle}` : "No active subscription"}>
            <div className="space-y-4">
              {[
                { label: "Students", used: students ?? 0, limit: plan?.max_students ?? 0 },
                { label: "Lecturers", used: lecturers ?? 0, limit: plan?.max_lecturers ?? 0 },
                { label: "Courses", used: courses ?? 0, limit: plan?.max_courses ?? 0 },
              ].map((item) => {
                const pct = item.limit ? Math.min((item.used / item.limit) * 100, 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">
                        {formatNumber(item.used)} / {formatNumber(item.limit)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
            <Button asChild variant="outline" size="sm" className="mt-5 w-full">
              <Link href="/admin/subscription">Manage subscription</Link>
            </Button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
