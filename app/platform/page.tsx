import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

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
  formatPercent,
  percentage,
} from "@/lib/utils";

const institutionBadge: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  pending: "warning",
  suspended: "destructive",
  deleted: "muted",
};

const paymentBadge: Record<string, "success" | "warning" | "info" | "destructive" | "muted"> = {
  success: "success",
  pending: "warning",
  failed: "destructive",
  abandoned: "muted",
  refunded: "info",
};

function monthlyValue(price: number, cycle: string) {
  switch (cycle) {
    case "annual":
      return price / 12;
    case "semester":
      return price / 6;
    default:
      return price;
  }
}

export default async function PlatformOverviewPage() {
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const [
    { data: institutions },
    { count: profiles },
    { count: students },
    { data: subscriptions },
    { data: payments },
    { data: recentInstitutions },
    { data: recentPayments },
    { count: openTickets },
    { data: webhookEvents },
  ] = await Promise.all([
    supabase.from("institutions").select("id, name, slug, status, created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .not("matric_number", "is", null),
    supabase
      .from("subscriptions")
      .select(
        "id, institution_id, status, ends_at, trial_ends_at, plan:subscription_plans(name, price_ngn, billing_cycle)"
      )
      .in("status", ["trialing", "active", "past_due"]),
    supabase
      .from("payments")
      .select("amount, status, paid_at, created_at, gateway, institution_id")
      .eq("status", "success"),
    supabase
      .from("institutions")
      .select("id, name, slug, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("payments")
      .select(
        "id, reference, amount, gateway, status, created_at, institution:institutions(name)"
      )
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    supabase
      .from("payment_webhook_events")
      .select("id, gateway, event_type, processed_at, signature_valid, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const allInstitutions = institutions ?? [];
  const activeInstitutions = allInstitutions.filter((row) => row.status === "active").length;
  const suspendedInstitutions = allInstitutions.filter((row) => row.status === "suspended").length;

  const liveSubscriptions = subscriptions ?? [];
  const activeSubscriptions = liveSubscriptions.filter((row) => row.status === "active");
  const trialingSubscriptions = liveSubscriptions.filter((row) => row.status === "trialing");
  const mrr = activeSubscriptions.reduce((sum, row) => {
    const plan = row.plan as unknown as { price_ngn: number | string; billing_cycle: string } | null;
    return plan ? sum + monthlyValue(Number(plan.price_ngn), plan.billing_cycle) : sum;
  }, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const allPayments = payments ?? [];
  const revenueThisMonth = allPayments
    .filter((row) => {
      const date = new Date(row.paid_at ?? row.created_at);
      return date >= monthStart;
    })
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const lifetimeRevenue = allPayments.reduce((sum, row) => sum + Number(row.amount), 0);

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const next = new Date(now.getFullYear(), now.getMonth() - (5 - index) + 1, 1);
    const total = allPayments
      .filter((row) => {
        const paid = new Date(row.paid_at ?? row.created_at);
        return paid >= date && paid < next;
      })
      .reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      label: date.toLocaleDateString("en-NG", { month: "short" }),
      total,
    };
  });
  const peak = Math.max(...months.map((month) => month.total), 1);

  const trialsEndingSoon = trialingSubscriptions.filter((row) => {
    if (!row.trial_ends_at) return false;
    const diff = new Date(row.trial_ends_at).getTime() - now.getTime();
    return diff > 0 && diff <= 7 * 86_400_000;
  }).length;

  const conversion = percentage(activeSubscriptions.length, liveSubscriptions.length);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Platform"
        title="Business overview"
        description="Institution growth, subscription health and verified payment revenue across MaideenAttendee."
        actions={
          <Button asChild variant="outline">
            <Link href="/platform/revenue">
              Revenue analytics <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Institutions"
          value={formatNumber(allInstitutions.length)}
          icon={Building2}
          tone="brand"
          hint={`${activeInstitutions} active · ${suspendedInstitutions} suspended`}
        />
        <StatCard
          label="Active subscriptions"
          value={formatNumber(activeSubscriptions.length)}
          icon={CreditCard}
          tone="success"
          hint={`${trialingSubscriptions.length} on trial`}
        />
        <StatCard label="MRR" value={formatNGN(mrr, true)} icon={TrendingUp} hint="Normalised monthly value" />
        <StatCard
          label="Revenue this month"
          value={formatNGN(revenueThisMonth, true)}
          icon={Receipt}
          hint={`${formatNGN(lifetimeRevenue, true)} lifetime`}
        />
        <StatCard
          label="Trial conversion"
          value={formatPercent(conversion, 0)}
          icon={Users}
          hint={`${trialsEndingSoon} trials end within 7 days`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Verified revenue"
          description="Successful payments only, bucketed by the month they were paid."
        >
          <div className="flex h-48 items-end gap-3">
            {months.map((month) => {
              const height = Math.max((month.total / peak) * 100, month.total > 0 ? 4 : 1);
              return (
                <div key={month.label} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {month.total > 0 ? formatNGN(month.total, true) : "—"}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400"
                    style={{ height: `${height}%` }}
                    title={`${month.label}: ${formatNGN(month.total)}`}
                  />
                  <span className="text-[11px] text-muted-foreground">{month.label}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Operations">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Registered users</dt>
                <dd className="font-medium">{formatNumber(profiles ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Students</dt>
                <dd className="font-medium">{formatNumber(students ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Open support tickets</dt>
                <dd>
                  <Badge variant={openTickets ? "warning" : "success"}>{openTickets ?? 0}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Past due</dt>
                <dd>
                  <Badge
                    variant={
                      liveSubscriptions.some((row) => row.status === "past_due")
                        ? "destructive"
                        : "success"
                    }
                  >
                    {liveSubscriptions.filter((row) => row.status === "past_due").length}
                  </Badge>
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Recent webhooks
              </p>
              {(webhookEvents ?? []).length > 0 ? (
                <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                  {(webhookEvents ?? []).map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-2">
                      <span className="truncate capitalize">
                        {event.gateway} · {event.event_type ?? "event"}
                      </span>
                      <Badge variant={event.processed_at ? "success" : "warning"}>
                        {event.processed_at ? "processed" : "pending"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">No webhook events received yet.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Quick links">
            <div className="grid gap-2">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/platform/institutions">
                  <Building2 /> Manage institutions
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/platform/plans">
                  <CreditCard /> Subscription plans
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link href="/platform/gateways">
                  <Wallet /> Payment gateways
                </Link>
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Newest institutions"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/platform/institutions">
                View all <ArrowRight />
              </Link>
            </Button>
          }
          contentClassName="p-0"
        >
          {recentInstitutions && recentInstitutions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInstitutions.map((institution) => (
                  <TableRow key={institution.id}>
                    <TableCell>
                      <Link
                        href={`/platform/institutions/${institution.id}`}
                        className="font-medium hover:text-brand-600"
                      >
                        {institution.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">/{institution.slug}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={institutionBadge[institution.status] ?? "muted"}
                        className="capitalize"
                      >
                        {institution.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(institution.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={Building2}
                title="No institutions yet"
                description="Institutions appear here when they register."
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Latest payments"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/platform/payments">
                View all <ArrowRight />
              </Link>
            </Button>
          }
          contentClassName="p-0"
        >
          {recentPayments && recentPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.map((payment) => {
                  const institution = payment.institution as unknown as { name: string } | null;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{institution?.name ?? "—"}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {payment.reference}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{payment.gateway}</TableCell>
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
            <div className="p-5">
              <EmptyState
                icon={Receipt}
                title="No payments yet"
                description="Verified subscription payments appear here."
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
