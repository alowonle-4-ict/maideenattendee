import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarCheck2,
  ClipboardList,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";

import { InstitutionActions } from "@/components/platform/actions";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/dashboard/page-header";
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
  formatDate,
  formatNGN,
  formatNumber,
  isUuid,
} from "@/lib/utils";

const statusBadge: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  pending: "warning",
  suspended: "destructive",
  deleted: "muted",
};

const subscriptionBadge: Record<string, "success" | "warning" | "info" | "destructive" | "muted"> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  expired: "destructive",
  cancelled: "muted",
  pending: "warning",
};

const paymentBadge: Record<string, "success" | "warning" | "info" | "destructive" | "muted"> = {
  success: "success",
  pending: "warning",
  failed: "destructive",
  abandoned: "muted",
  refunded: "info",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function PlatformInstitutionDetailPage({ params }: PageProps) {
  const { id } = await params;
  await requireAuth(["super_admin"]);
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: institution } = await supabase
    .from("institutions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!institution) notFound();

  const [
    { data: settings },
    { data: subscription },
    { count: students },
    { count: lecturers },
    { count: courses },
    { count: sessions },
    { count: records },
    { count: facultyCount },
    { data: adminRoles },
    { data: payments },
    { data: auditLogs },
  ] = await Promise.all([
    supabase
      .from("institution_settings")
      .select(
        "attendance_threshold, late_after_minutes, grace_period_days, timezone, max_students_override, max_lecturers_override, max_courses_override"
      )
      .eq("institution_id", id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select(
        "id, status, starts_at, ends_at, trial_ends_at, auto_renew, cancelled_at, plan:subscription_plans(name, price_ngn, billing_cycle, max_students, max_lecturers, max_courses)"
      )
      .eq("institution_id", id)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", id)
      .eq("role", "student"),
    supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", id)
      .eq("role", "lecturer"),
    supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", id),
    supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", id),
    supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", id),
    supabase
      .from("faculties")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", id),
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("institution_id", id)
      .eq("role", "institution_admin"),
    supabase
      .from("payments")
      .select("id, reference, amount, gateway, status, created_at, plan:subscription_plans(name)")
      .eq("institution_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("audit_logs")
      .select("id, action, actor_email, entity_type, created_at")
      .eq("institution_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const adminIds = (adminRoles ?? []).map((row) => row.user_id);
  const { data: admins } = adminIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, phone, is_active")
        .in("id", adminIds)
    : { data: [] as { id: string; full_name: string; email: string; phone: string | null; is_active: boolean }[] };

  const plan = subscription?.plan as unknown as {
    name: string;
    price_ngn: number | string;
    billing_cycle: string;
    max_students: number;
    max_lecturers: number;
    max_courses: number;
  } | null;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={institution.slug}
        title={institution.name}
        description={`Joined ${formatDate(institution.created_at)} · ${institution.email}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/platform/institutions">
                <ArrowLeft /> All institutions
              </Link>
            </Button>
            <InstitutionActions
              id={institution.id}
              name={institution.name}
              status={institution.status}
            />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={statusBadge[institution.status] ?? "muted"} className="capitalize">
          {institution.status}
        </Badge>
        {subscription && (
          <Badge
            variant={subscriptionBadge[subscription.status] ?? "muted"}
            className="capitalize"
          >
            Subscription: {subscription.status}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Students" value={formatNumber(students ?? 0)} icon={GraduationCap} />
        <StatCard label="Lecturers" value={formatNumber(lecturers ?? 0)} icon={Users} />
        <StatCard label="Courses" value={formatNumber(courses ?? 0)} icon={BookOpen} />
        <StatCard label="Faculties" value={formatNumber(facultyCount ?? 0)} icon={Building2} />
        <StatCard label="Sessions" value={formatNumber(sessions ?? 0)} icon={CalendarCheck2} />
        <StatCard label="Records" value={formatNumber(records ?? 0)} icon={ClipboardList} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title="Institution profile">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>{institution.email}</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>{institution.phone ?? "No phone number"}</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>{institution.address ?? "No address"}</span>
            </li>
          </ul>
          <div className="mt-4 space-y-2 border-t pt-4 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Slug</span>
              <span className="font-mono">{institution.slug}</span>
            </div>
            <div className="flex justify-between">
              <span>Attendance threshold</span>
              <span>{settings?.attendance_threshold ?? 75}%</span>
            </div>
            <div className="flex justify-between">
              <span>Late after</span>
              <span>{settings?.late_after_minutes ?? 15} minutes</span>
            </div>
            <div className="flex justify-between">
              <span>Grace period</span>
              <span>{settings?.grace_period_days ?? 7} days</span>
            </div>
            <div className="flex justify-between">
              <span>Timezone</span>
              <span>{settings?.timezone ?? "Africa/Lagos"}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="lg:col-span-2"
          title="Subscription"
          description="Limits are enforced when administrators add students, lecturers or courses."
        >
          {subscription && plan ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-semibold">{plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatNGN(plan.price_ngn)} · {plan.billing_cycle}
                  </p>
                </div>
                <Badge
                  variant={subscriptionBadge[subscription.status] ?? "muted"}
                  className="capitalize"
                >
                  {subscription.status}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Started</dt>
                  <dd>{formatDate(subscription.starts_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">
                    {subscription.status === "trialing" ? "Trial ends" : "Period ends"}
                  </dt>
                  <dd>{formatDate(subscription.trial_ends_at ?? subscription.ends_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Auto renew</dt>
                  <dd>{subscription.auto_renew ? "On" : "Off"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Cancelled</dt>
                  <dd>{subscription.cancelled_at ? formatDate(subscription.cancelled_at) : "No"}</dd>
                </div>
              </dl>
              <div className="mt-4 grid gap-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-3">
                <div>
                  Students: <span className="font-medium text-foreground">{students ?? 0}</span> /{" "}
                  {settings?.max_students_override ?? plan.max_students}
                </div>
                <div>
                  Lecturers: <span className="font-medium text-foreground">{lecturers ?? 0}</span> /{" "}
                  {settings?.max_lecturers_override ?? plan.max_lecturers}
                </div>
                <div>
                  Courses: <span className="font-medium text-foreground">{courses ?? 0}</span> /{" "}
                  {settings?.max_courses_override ?? plan.max_courses}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              This institution has no live subscription. Plan limits are not enforced.
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Administrators" contentClassName="p-0">
          {admins && admins.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.full_name}</TableCell>
                    <TableCell className="text-sm">{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant={admin.is_active ? "success" : "destructive"}>
                        {admin.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No administrator accounts.</p>
          )}
        </SectionCard>

        <SectionCard title="Recent payments" contentClassName="p-0">
          {payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const paymentPlan = payment.plan as unknown as { name: string } | null;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <p className="max-w-[150px] truncate font-mono text-[11px]">
                          {payment.reference}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {payment.gateway} · {formatDate(payment.created_at)}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{paymentPlan?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatNGN(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={paymentBadge[payment.status] ?? "muted"}
                          className="capitalize"
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No payments recorded.</p>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Audit trail" contentClassName="p-0">
          {auditLogs && auditLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell className="text-sm">{log.actor_email ?? "System"}</TableCell>
                    <TableCell className="text-sm">{log.entity_type ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(log.created_at, { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={ClipboardList}
                title="No audit events"
                description="Administrative actions for this institution will appear here."
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
