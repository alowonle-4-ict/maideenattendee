import Link from "next/link";
import { ArrowRight, CreditCard, Receipt, TrendingUp, Wallet } from "lucide-react";

import { PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
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
import { formatNGN, formatNumber, formatPercent, percentage } from "@/lib/utils";

function monthlyValue(price: number, cycle: string) {
  switch (cycle) {
    case "annual":
      return price / 12;
    case "semester":
      return price / 6;
    case "custom":
      return price / 12;
    default:
      return price;
  }
}

type PaymentRow = {
  amount: number | string;
  gateway: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  institution_id: string;
  institution: { name: string; slug: string } | null;
  plan: { name: string } | null;
};

type SubscriptionRow = {
  status: string;
  ends_at: string | null;
  plan: { name: string; price_ngn: number | string; billing_cycle: string } | null;
};

export default async function PlatformRevenuePage() {
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const [{ data: paymentData }, { data: subscriptionData }, { count: institutionCount }] =
    await Promise.all([
      supabase
        .from("payments")
        .select(
          "amount, gateway, status, paid_at, created_at, institution_id, institution:institutions(name, slug), plan:subscription_plans(name)"
        )
        .eq("status", "success")
        .order("paid_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("status, ends_at, plan:subscription_plans(name, price_ngn, billing_cycle)")
        .in("status", ["trialing", "active", "past_due"]),
      supabase.from("institutions").select("*", { count: "exact", head: true }),
    ]);

  const payments = (paymentData ?? []) as unknown as PaymentRow[];
  const subscriptions = (subscriptionData ?? []) as unknown as SubscriptionRow[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const lifetime = payments.reduce((sum, row) => sum + Number(row.amount), 0);
  const thisMonth = payments
    .filter((row) => new Date(row.paid_at ?? row.created_at) >= monthStart)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const thisYear = payments
    .filter((row) => new Date(row.paid_at ?? row.created_at) >= yearStart)
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const active = subscriptions.filter((row) => row.status === "active");
  const mrr = active.reduce((sum, row) => {
    const plan = row.plan;
    return plan ? sum + monthlyValue(Number(plan.price_ngn), plan.billing_cycle) : sum;
  }, 0);

  const byGateway = new Map<string, { total: number; count: number }>();
  const byInstitution = new Map<string, { name: string; slug: string; total: number; count: number }>();
  const byPlan = new Map<string, { total: number; count: number }>();

  payments.forEach((row) => {
    const amount = Number(row.amount);
    const gateway = byGateway.get(row.gateway) ?? { total: 0, count: 0 };
    gateway.total += amount;
    gateway.count += 1;
    byGateway.set(row.gateway, gateway);

    const institution = byInstitution.get(row.institution_id) ?? {
      name: row.institution?.name ?? "Unknown institution",
      slug: row.institution?.slug ?? "",
      total: 0,
      count: 0,
    };
    institution.total += amount;
    institution.count += 1;
    byInstitution.set(row.institution_id, institution);

    const planName = row.plan?.name ?? "Unattributed";
    const plan = byPlan.get(planName) ?? { total: 0, count: 0 };
    plan.total += amount;
    plan.count += 1;
    byPlan.set(planName, plan);
  });

  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const next = new Date(now.getFullYear(), now.getMonth() - (11 - index) + 1, 1);
    const total = payments
      .filter((row) => {
        const paid = new Date(row.paid_at ?? row.created_at);
        return paid >= date && paid < next;
      })
      .reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      label: date.toLocaleDateString("en-NG", { month: "short" }),
      year: date.getFullYear(),
      total,
    };
  });
  const peak = Math.max(...months.map((month) => month.total), 1);
  const previousMonth = months.at(-2)?.total ?? 0;
  const monthGrowth = previousMonth ? ((thisMonth - previousMonth) / previousMonth) * 100 : 0;

  const topInstitutions = [...byInstitution.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  const gatewayRows = [...byGateway.entries()].sort((a, b) => b[1].total - a[1].total);
  const planRows = [...byPlan.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Revenue"
        title="Revenue analytics"
        description="Verified gateway revenue only. Failed, abandoned and pending transactions are excluded."
        actions={
          <Button asChild variant="outline">
            <Link href="/platform/payments">
              Payment ledger <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lifetime revenue"
          value={formatNGN(lifetime, true)}
          hint={`${formatNumber(payments.length)} payments`}
          icon={Receipt}
          tone="success"
        />
        <StatCard
          label="Revenue this month"
          value={formatNGN(thisMonth, true)}
          hint={
            previousMonth
              ? `${monthGrowth >= 0 ? "+" : ""}${formatPercent(monthGrowth)} vs last month`
              : "First month of revenue"
          }
          icon={TrendingUp}
          tone="brand"
        />
        <StatCard
          label="MRR"
          value={formatNGN(mrr, true)}
          hint={`${formatNGN(mrr * 12, true)} annual run rate`}
          icon={CreditCard}
        />
        <StatCard
          label="Revenue this year"
          value={formatNGN(thisYear, true)}
          hint={`${formatNumber(institutionCount ?? 0)} institutions on the platform`}
          icon={Wallet}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Monthly revenue"
          description="Successful payments by month, rolling 12 months."
        >
          <div className="flex h-56 items-end gap-1.5 sm:gap-2">
            {months.map((month) => {
              const height = Math.max((month.total / peak) * 100, month.total > 0 ? 5 : 1);
              return (
                <div
                  key={`${month.year}-${month.label}`}
                  className="group flex flex-1 flex-col items-center justify-end gap-2"
                  title={`${month.label} ${month.year}: ${formatNGN(month.total)}`}
                >
                  <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {formatNGN(month.total, true)}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-brand-900 via-brand-600 to-brand-400 transition-opacity group-hover:opacity-80"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{month.label}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Gateway split" description="Where verified revenue came from.">
          {gatewayRows.length ? (
            <div className="space-y-4">
              {gatewayRows.map(([gateway, entry]) => (
                <div key={gateway}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{gateway}</span>
                    <span>{formatNGN(entry.total, true)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${percentage(entry.total, lifetime)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatPercent(percentage(entry.total, lifetime))} of revenue ·{" "}
                    {formatNumber(entry.count)} payments
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No verified payments yet. Revenue appears here after the first successful
              transaction.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Top institutions"
          description="Ranked by verified lifetime revenue."
          contentClassName="p-0"
        >
          {topInstitutions.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topInstitutions.map((institution) => (
                  <TableRow key={institution.slug || institution.name}>
                    <TableCell className="font-medium">{institution.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatNumber(institution.count)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNGN(institution.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No institutional revenue yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Revenue by plan"
          description="Which plans institutions actually pay for."
          contentClassName="p-0"
        >
          {planRows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planRows.map(([plan, entry]) => (
                  <TableRow key={plan}>
                    <TableCell className="font-medium">{plan}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatNumber(entry.count)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNGN(entry.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No plan revenue yet.</p>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="success">Verified only</Badge>
        <span>
          Refunded payments are excluded from revenue totals and remain visible in the payment
          ledger for reconciliation.
        </span>
      </div>
    </div>
  );
}
