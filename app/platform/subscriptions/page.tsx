import Link from "next/link";
import { CreditCard, Search } from "lucide-react";

import { EmptyState, PageHeader, StatCard } from "@/components/dashboard/page-header";
import { SubscriptionActions } from "@/components/platform/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDate, formatNGN, formatNumber } from "@/lib/utils";

const PAGE_SIZE = 25;
const STATUSES = ["trialing", "active", "past_due", "expired", "cancelled", "pending"] as const;

const statusBadge: Record<
  string,
  "success" | "warning" | "info" | "destructive" | "muted"
> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  expired: "destructive",
  cancelled: "muted",
  pending: "warning",
};

type SubscriptionRow = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  auto_renew: boolean;
  cancelled_at: string | null;
  institution: { id: string; name: string; slug: string } | null;
  plan: {
    name: string;
    price_ngn: number | string;
    billing_cycle: string;
  } | null;
};

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
};

export default async function PlatformSubscriptionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;
  const q = (params.q ?? "").replace(/[%,()]/g, " ").trim();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("subscriptions")
    .select(
      "id, status, starts_at, ends_at, trial_ends_at, auto_renew, cancelled_at, institution:institutions!inner(id, name, slug), plan:subscription_plans(name, price_ngn, billing_cycle)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`, { foreignTable: "institutions" });

  const { data, count } = await query;
  const subscriptions = (data ?? []) as unknown as SubscriptionRow[];

  const [{ count: liveCount }, { count: pastDueCount }, { count: trialingCount }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "past_due"),
      supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "trialing"),
    ]);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function href(overrides: Record<string, string | undefined>) {
    const merged = { status, q: q || undefined, ...overrides };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const queryString = search.toString();
    return queryString
      ? `/platform/subscriptions?${queryString}`
      : "/platform/subscriptions";
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Revenue"
        title="Subscriptions"
        description="Every institution can hold one live subscription. Payments extend the current period instead of creating duplicates."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active" value={formatNumber(liveCount ?? 0)} icon={CreditCard} tone="success" />
        <StatCard label="On trial" value={formatNumber(trialingCount ?? 0)} icon={CreditCard} tone="brand" />
        <StatCard
          label="Past due"
          value={formatNumber(pastDueCount ?? 0)}
          icon={CreditCard}
          tone={(pastDueCount ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-1 items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search institution name or slug"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          <Button asChild size="sm" variant={!status ? "default" : "outline"}>
            <Link href={href({ status: undefined, page: undefined })}>All</Link>
          </Button>
          {STATUSES.map((item) => (
            <Button key={item} asChild size="sm" variant={status === item ? "default" : "outline"}>
              <Link href={href({ status: item, page: undefined })} className="capitalize">
                {item.replace("_", " ")}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {subscriptions.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Trial ends</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell>
                    {subscription.institution ? (
                      <Link
                        href={`/platform/institutions/${subscription.institution.id}`}
                        className="font-medium hover:text-brand-600"
                      >
                        {subscription.institution.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unknown institution</span>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      /{subscription.institution?.slug ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {subscription.plan?.name ?? "—"}
                    <p className="text-[11px] text-muted-foreground">
                      {subscription.plan ? formatNGN(subscription.plan.price_ngn) : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusBadge[subscription.status] ?? "muted"}
                      className="capitalize"
                    >
                      {subscription.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] leading-relaxed text-muted-foreground">
                    {formatDate(subscription.starts_at)}
                    <br />
                    {subscription.ends_at ? formatDate(subscription.ends_at) : "No end date"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {subscription.trial_ends_at ? formatDate(subscription.trial_ends_at) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {subscription.cancelled_at
                      ? "Cancelled"
                      : subscription.auto_renew
                        ? "Auto renew"
                        : "Manual"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <SubscriptionActions id={subscription.id} status={subscription.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={CreditCard}
            title="No subscriptions match"
            description={
              q || status
                ? "Try clearing the filters or searching for a different institution."
                : "Subscriptions are created when an institution registers for a trial or completes a verified payment."
            }
            action={
              q || status ? (
                <Button asChild variant="outline">
                  <Link href="/platform/subscriptions">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Page {page} of {totalPages} · {formatNumber(total)} subscriptions
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" aria-disabled={page <= 1}>
              <Link href={href({ page: String(Math.max(1, page - 1)) })}>Previous</Link>
            </Button>
            <Button asChild size="sm" variant="outline" aria-disabled={page >= totalPages}>
              <Link href={href({ page: String(Math.min(totalPages, page + 1)) })}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
