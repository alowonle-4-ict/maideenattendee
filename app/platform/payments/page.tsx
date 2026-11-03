import Link from "next/link";
import { Receipt, Search } from "lucide-react";

import { VerifyPaymentButton } from "@/components/billing/billing-actions";
import { EmptyState, PageHeader, StatCard } from "@/components/dashboard/page-header";
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
import { formatDateTime, formatNGN, formatNumber } from "@/lib/utils";

const PAGE_SIZE = 25;
const STATUSES = ["pending", "success", "failed", "abandoned", "refunded"] as const;
const GATEWAYS = ["paystack", "flutterwave"] as const;

const statusBadge: Record<
  string,
  "success" | "warning" | "destructive" | "muted" | "info"
> = {
  success: "success",
  pending: "warning",
  failed: "destructive",
  abandoned: "muted",
  refunded: "info",
};

type PaymentRow = {
  id: string;
  reference: string;
  gateway_reference: string | null;
  amount: number | string;
  currency: string;
  gateway: string;
  status: string;
  channel: string | null;
  paid_at: string | null;
  failure_reason: string | null;
  created_at: string;
  institution: { id: string; name: string; slug: string } | null;
  plan: { name: string } | null;
};

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    gateway?: string;
    page?: string;
  }>;
};

export default async function PlatformPaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const q = (params.q ?? "").replace(/[%,()]/g, " ").trim();
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;
  const gateway = GATEWAYS.includes(params.gateway as (typeof GATEWAYS)[number])
    ? (params.gateway as (typeof GATEWAYS)[number])
    : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("payments")
    .select(
      "id, reference, gateway_reference, amount, currency, gateway, status, channel, paid_at, failure_reason, created_at, institution:institutions!inner(id, name, slug), plan:subscription_plans(name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (gateway) query = query.eq("gateway", gateway);
  if (q) {
    query = query.or(`reference.ilike.%${q}%,gateway_reference.ilike.%${q}%`);
  }

  const { data, count } = await query;
  const payments = (data ?? []) as unknown as PaymentRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [{ data: allSuccess }, { count: attentionCount }] = await Promise.all([
    supabase.from("payments").select("amount, gateway, paid_at, created_at").eq("status", "success"),
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "failed"]),
  ]);

  const lifetime = (allSuccess ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  function href(overrides: Record<string, string | undefined>) {
    const merged = { q: q || undefined, status, gateway, ...overrides };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const queryString = search.toString();
    return queryString ? `/platform/payments?${queryString}` : "/platform/payments";
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Revenue"
        title="Payments"
        description="Only payments confirmed by the gateway are counted as revenue. Use Verify to re-check a transaction server-side."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Verified revenue"
          value={formatNGN(lifetime, true)}
          hint={`${formatNumber(allSuccess?.length ?? 0)} successful payments`}
          icon={Receipt}
          tone="success"
        />
        <StatCard
          label="Needs attention"
          value={formatNumber(attentionCount ?? 0)}
          hint="Pending or failed transactions"
          icon={Receipt}
          tone={(attentionCount ?? 0) > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Average payment"
          value={
            allSuccess?.length
              ? formatNGN(lifetime / allSuccess.length, true)
              : "—"
          }
          hint="Across successful payments"
          icon={Receipt}
        />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-1 items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {gateway && <input type="hidden" name="gateway" value={gateway} />}
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search reference or institution"
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
                {item}
              </Link>
            </Button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {GATEWAYS.map((item) => (
            <Button
              key={item}
              asChild
              size="sm"
              variant={gateway === item ? "default" : "outline"}
            >
              <Link href={href({ gateway: item, page: undefined })} className="capitalize">
                {item}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {payments.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <p className="font-mono text-[11px] font-medium">{payment.reference}</p>
                    {payment.gateway_reference && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {payment.gateway_reference}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {payment.institution ? (
                      <Link
                        href={`/platform/institutions/${payment.institution.id}`}
                        className="hover:text-brand-600"
                      >
                        {payment.institution.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{payment.plan?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm capitalize">
                    {payment.gateway}
                    {payment.channel && (
                      <p className="text-[11px] capitalize text-muted-foreground">
                        {payment.channel}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {formatNGN(payment.amount)}
                    <p className="text-[11px] text-muted-foreground">{payment.currency}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusBadge[payment.status] ?? "muted"}
                      className="capitalize"
                    >
                      {payment.status}
                    </Badge>
                    {payment.failure_reason && (
                      <p className="mt-1 max-w-[160px] text-[10px] leading-tight text-muted-foreground">
                        {payment.failure_reason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {formatDateTime(payment.created_at)}
                    {payment.paid_at && (
                      <p className="text-success">Paid {formatDateTime(payment.paid_at)}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {payment.status === "success" ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <VerifyPaymentButton reference={payment.reference} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Receipt}
            title="No payments match"
            description="Payments appear here after an institution starts a checkout with Paystack or Flutterwave."
            action={
              <Button asChild variant="outline">
                <Link href="/platform/payments">Clear filters</Link>
              </Button>
            }
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Page {page} of {totalPages} · {formatNumber(total)} payments
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
