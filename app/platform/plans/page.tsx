import { Layers, Users } from "lucide-react";

import { EntityDialog } from "@/components/admin/entity-dialog";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
import { PlanActiveToggle } from "@/components/platform/plan-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { savePlan } from "@/lib/actions/platform";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNGN, formatNumber } from "@/lib/utils";

const CYCLE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "semester", label: "Per semester" },
  { value: "annual", label: "Annual" },
  { value: "custom", label: "Custom" },
];

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  semester: "Per semester",
  annual: "Annual",
  custom: "Custom",
};

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_ngn: number | string;
  billing_cycle: string;
  duration_days: number;
  max_students: number;
  max_lecturers: number;
  max_courses: number;
  features: string[] | null;
  is_active: boolean;
  sort_order: number;
  subscriptions: { count: number }[];
};

function planFields(plan?: PlanRow) {
  return [
    {
      name: "name",
      label: "Plan name",
      required: true,
      defaultValue: plan?.name,
      placeholder: "Professional",
    },
    {
      name: "slug",
      label: "Slug",
      required: true,
      defaultValue: plan?.slug,
      placeholder: "professional",
      help: "Used in URLs and receipts. Lowercase letters, numbers and hyphens.",
    },
    {
      name: "price_ngn",
      label: "Price (NGN)",
      type: "number" as const,
      required: true,
      min: 0,
      step: 100,
      defaultValue: plan ? Number(plan.price_ngn) : 0,
    },
    {
      name: "billing_cycle",
      label: "Billing cycle",
      type: "select" as const,
      defaultValue: plan?.billing_cycle ?? "monthly",
      options: CYCLE_OPTIONS,
    },
    {
      name: "duration_days",
      label: "Access duration (days)",
      type: "number" as const,
      required: true,
      min: 1,
      defaultValue: plan?.duration_days ?? 30,
      help: "Added to the current end date each time a payment is confirmed.",
    },
    {
      name: "sort_order",
      label: "Display order",
      type: "number" as const,
      min: 0,
      defaultValue: plan?.sort_order ?? 0,
    },
    {
      name: "max_students",
      label: "Maximum students",
      type: "number" as const,
      required: true,
      min: 1,
      defaultValue: plan?.max_students ?? 100,
    },
    {
      name: "max_lecturers",
      label: "Maximum lecturers",
      type: "number" as const,
      required: true,
      min: 1,
      defaultValue: plan?.max_lecturers ?? 10,
    },
    {
      name: "max_courses",
      label: "Maximum courses",
      type: "number" as const,
      required: true,
      min: 1,
      defaultValue: plan?.max_courses ?? 10,
    },
    {
      name: "features",
      label: "Features",
      type: "textarea" as const,
      full: true,
      defaultValue: (plan?.features ?? []).join("\n"),
      placeholder: "QR attendance\nOffline attendance\nAdvanced analytics",
      help: "One feature per line. Shown on the pricing page and billing screens.",
    },
    {
      name: "is_active",
      label: "Available to institutions",
      type: "switch" as const,
      defaultValue: plan ? (plan.is_active ? 1 : 0) : 1,
    },
  ];
}

export default async function PlatformPlansPage() {
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("subscription_plans")
    .select(
      "id, name, slug, description, price_ngn, billing_cycle, duration_days, max_students, max_lecturers, max_courses, features, is_active, sort_order, subscriptions(count)"
    )
    .order("sort_order", { ascending: true })
    .order("price_ngn", { ascending: true });

  const plans = (data ?? []) as unknown as PlanRow[];
  const activePlans = plans.filter((plan) => plan.is_active);
  const liveSubscriptions = plans.reduce(
    (sum, plan) => sum + Number(plan.subscriptions?.[0]?.count ?? 0),
    0
  );

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Revenue"
        title="Subscription plans"
        description="Plans control pricing and institution limits. Editing a plan does not alter existing paid periods."
        actions={
          <EntityDialog
            triggerLabel="New plan"
            triggerIcon={<Layers />}
            title="Create subscription plan"
            description="Plans become available on the pricing page and institution billing screens when active."
            fields={planFields()}
            action={savePlan}
            submitLabel="Create plan"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Plans"
          value={formatNumber(plans.length)}
          hint={`${activePlans.length} available to institutions`}
          icon={Layers}
          tone="brand"
        />
        <StatCard
          label="Active subscriptions"
          value={formatNumber(liveSubscriptions)}
          hint="Trialing, active or past due"
          icon={Users}
          tone="success"
        />
        <StatCard
          label="Entry price"
          value={
            activePlans.length
              ? formatNGN(
                  Math.min(...activePlans.map((plan) => Number(plan.price_ngn))),
                  true
                )
              : "—"
          }
          hint="Lowest active plan price"
          icon={Layers}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-card">
        {plans.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Subscriptions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      /{plan.slug} · order {plan.sort_order}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {formatNGN(plan.price_ngn)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {CYCLE_LABEL[plan.billing_cycle] ?? plan.billing_cycle}
                    <p className="text-[11px] text-muted-foreground">
                      {plan.duration_days} days
                    </p>
                  </TableCell>
                  <TableCell className="text-[11px] leading-relaxed text-muted-foreground">
                    {formatNumber(plan.max_students)} students
                    <br />
                    {formatNumber(plan.max_lecturers)} lecturers
                    <br />
                    {formatNumber(plan.max_courses)} courses
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatNumber(Number(plan.subscriptions?.[0]?.count ?? 0))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "success" : "muted"}>
                      {plan.is_active ? "Active" : "Hidden"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <EntityDialog
                        triggerLabel="Edit"
                        triggerVariant="outline"
                        triggerSize="sm"
                        triggerIcon={<Layers />}
                        title={`Edit ${plan.name}`}
                        fields={planFields(plan)}
                        hiddenValues={{ id: plan.id }}
                        action={savePlan}
                        submitLabel="Save plan"
                      />
                      <PlanActiveToggle id={plan.id} active={plan.is_active} name={plan.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Layers}
            title="No plans yet"
            description="Create your first subscription plan so institutions can subscribe after their trial."
            action={
              <EntityDialog
                triggerLabel="Create plan"
                triggerIcon={<Layers />}
                title="Create subscription plan"
                fields={planFields()}
                action={savePlan}
                submitLabel="Create plan"
              />
            }
          />
        )}
      </div>

      <SectionCard
        className="mt-6"
        title="How limits are enforced"
        description="Limits are checked when institutions create students, lecturers and courses — not only in the interface."
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Existing records above a reduced limit are never deleted; new creation is blocked.</li>
          <li>Institution-specific overrides in institution settings take precedence over the plan.</li>
          <li>Expired subscriptions fall back to the trial limits until a payment is verified.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
