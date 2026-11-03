import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { CancelRenewalButton } from "@/components/billing/billing-actions";
import { PlanCheckout } from "@/components/billing/plan-checkout";
import { CopyButton } from "@/components/admin/copy-button";
import { PageHeader, SectionCard } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireInstitution } from "@/lib/auth";
import { env } from "@/lib/env";
import { getGatewayAvailability } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionPlan } from "@/lib/types";
import { cn, formatDate, formatNGN } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "info" | "destructive" | "muted"> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  expired: "destructive",
  pending: "warning",
  cancelled: "muted",
};

const cycleLabel: Record<string, string> = {
  monthly: "month",
  semester: "semester",
  annual: "year",
  custom: "custom period",
};

export default async function AdminSubscriptionPage() {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [
    { data: subscription },
    { data: plans },
    { data: settings },
    { count: students },
    { count: lecturers },
    { count: courses },
    gateways,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("institution_id", institutionId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle(),
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("institution_settings")
      .select("max_students_override, max_lecturers_override, max_courses_override")
      .eq("institution_id", institutionId)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "student"),
    supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "lecturer"),
    supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId),
    getGatewayAvailability(),
  ]);

  const plan = subscription?.plan as unknown as SubscriptionPlan | null;
  const limits = {
    students: settings?.max_students_override ?? plan?.max_students ?? null,
    lecturers: settings?.max_lecturers_override ?? plan?.max_lecturers ?? null,
    courses: settings?.max_courses_override ?? plan?.max_courses ?? null,
  };
  const usage = [
    { label: "Students", used: students ?? 0, limit: limits.students },
    { label: "Lecturers", used: lecturers ?? 0, limit: limits.lecturers },
    { label: "Courses", used: courses ?? 0, limit: limits.courses },
  ];

  const daysLeft = subscription?.ends_at
    ? Math.ceil((new Date(subscription.ends_at).getTime() - Date.now()) / 86_400_000)
    : null;
  const anyGatewayReady = gateways.some((gateway) => gateway.enabled && gateway.configured);

  return (
    <div className="page-shell">
      <PageHeader
        title="Subscription"
        description="Manage your institution's plan, resource limits and payment method."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/billing">
              <Receipt /> Billing history
            </Link>
          </Button>
        }
      />

      {!subscription && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            No live subscription was found for this institution. Choose a plan below to activate
            one. Until then, plan limits are not enforced.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Current plan"
          description={
            subscription
              ? "Your plan controls how many students, lecturers and courses your institution can manage."
              : "You do not have an active plan."
          }
          actions={
            subscription ? (
              <Badge variant={statusVariant[subscription.status] ?? "muted"} className="capitalize">
                {subscription.status.replace("_", " ")}
              </Badge>
            ) : null
          }
        >
          {subscription && plan ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold">{plan.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatNGN(plan.price_ngn)} per {cycleLabel[plan.billing_cycle] ?? plan.billing_cycle}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {subscription.status === "trialing" ? (
                    <p>
                      Trial ends {formatDate(subscription.trial_ends_at ?? subscription.ends_at)}
                    </p>
                  ) : (
                    <p>Renews / ends {formatDate(subscription.ends_at)}</p>
                  )}
                  {daysLeft != null && (
                    <p className={daysLeft <= 7 ? "text-warning" : undefined}>
                      {daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining` : "Expired"}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {usage.map((item) => {
                  const pct = item.limit ? Math.min((item.used / item.limit) * 100, 100) : 0;
                  const over = item.limit != null && item.used >= item.limit;
                  return (
                    <div key={item.label} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className={cn("font-medium", over && "text-destructive")}>
                          {item.used}
                          {item.limit != null ? ` / ${item.limit}` : ""}
                        </span>
                      </div>
                      <Progress value={pct} className="mt-2 h-1.5" />
                      {over && (
                        <p className="mt-1.5 text-[11px] text-destructive">
                          Limit reached. Upgrade to add more.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {subscription.status === "active" && subscription.auto_renew && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Automatic renewal is on. Cancelling keeps your plan active until{" "}
                    {formatDate(subscription.ends_at)}.
                  </p>
                  <CancelRenewalButton />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Choose a plan below to start. Payments are verified by the server before your
              subscription is activated.
            </div>
          )}
        </SectionCard>

        <SectionCard title="Payment gateways" description="Used for subscription payments in NGN.">
          <div className="space-y-3">
            {gateways.map((gateway) => (
              <div key={gateway.gateway} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{gateway.label}</p>
                  {gateway.configured && gateway.enabled ? (
                    <Badge variant="success">
                      <ShieldCheck className="h-3 w-3" /> Ready
                    </Badge>
                  ) : (
                    <Badge variant="warning">Unavailable</Badge>
                  )}
                </div>
                {!gateway.enabled && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Disabled by the platform administrator.
                  </p>
                )}
                {gateway.enabled && !gateway.configured && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Missing server variables: {gateway.missing.join(", ")}
                  </p>
                )}
              </div>
            ))}

            {!anyGatewayReady && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-[11px] text-warning">
                Online payment is not available yet. The platform administrator must configure a
                payment gateway before subscriptions can be purchased. No payment will be simulated.
              </div>
            )}

            <div className="space-y-2 border-t pt-3 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Webhook endpoints</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1">{env.appUrl}/api/webhooks/paystack</code>
                <CopyButton value={`${env.appUrl}/api/webhooks/paystack`} />
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1">{env.appUrl}/api/webhooks/flutterwave</code>
                <CopyButton value={`${env.appUrl}/api/webhooks/flutterwave`} />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-lg font-semibold">Available plans</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(plans ?? []).map((item) => {
            const current = subscription?.plan_id === item.id && subscription.status !== "expired";
            const features = Array.isArray(item.features) ? (item.features as string[]) : [];
            return (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-5 shadow-card",
                  current && "border-brand-300 ring-1 ring-brand-200 dark:border-brand-800 dark:ring-brand-900"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-base font-semibold">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatNGN(item.price_ngn)}
                      <span className="text-xs">
                        {" "}
                        / {cycleLabel[item.billing_cycle] ?? item.billing_cycle}
                      </span>
                    </p>
                  </div>
                  {current && <Badge variant="success">Current</Badge>}
                </div>

                {item.description && (
                  <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
                )}

                <ul className="mt-4 flex-1 space-y-1.5 text-xs">
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success" /> {item.max_students} students
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success" /> {item.max_lecturers} lecturers
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-success" /> {item.max_courses} courses
                  </li>
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {feature}
                    </li>
                  ))}
                </ul>

                {current ? (
                  <Button className="mt-4 w-full" variant="outline" disabled>
                    <CreditCard /> Current plan
                  </Button>
                ) : (
                  <PlanCheckout planId={item.id} planName={item.name} gateways={gateways} />
                )}
              </div>
            );
          })}
        </div>
        {(plans ?? []).length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No plans are published yet. Contact the platform administrator.
          </div>
        )}
      </div>
    </div>
  );
}
