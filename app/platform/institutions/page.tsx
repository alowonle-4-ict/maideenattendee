import Link from "next/link";
import { Building2, Search } from "lucide-react";

import { InstitutionActions } from "@/components/platform/actions";
import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
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
import { formatDate, formatNumber } from "@/lib/utils";

const PAGE_SIZE = 25;
const STATUSES = ["pending", "active", "suspended", "deleted"] as const;

const statusBadge: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  pending: "warning",
  suspended: "destructive",
  deleted: "muted",
};

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};

export default async function PlatformInstitutionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const q = (params.q ?? "").replace(/[%,()]/g, " ").trim();
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("institutions")
    .select("id, name, slug, email, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: institutions, count } = await query;
  const ids = (institutions ?? []).map((row) => row.id);

  const [{ data: roles }, { data: subscriptions }] = await Promise.all([
    ids.length
      ? supabase
          .from("user_roles")
          .select("institution_id, role")
          .in("institution_id", ids)
      : Promise.resolve({ data: [] as { institution_id: string; role: string }[] }),
    ids.length
      ? supabase
          .from("subscriptions")
          .select(
            "institution_id, status, ends_at, plan:subscription_plans(name, price_ngn, billing_cycle)"
          )
          .in("institution_id", ids)
          .in("status", ["trialing", "active", "past_due"])
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const roleCounts = new Map<string, { students: number; lecturers: number }>();
  (roles ?? []).forEach((row) => {
    const entry = roleCounts.get(row.institution_id) ?? { students: 0, lecturers: 0 };
    if (row.role === "student") entry.students += 1;
    if (row.role === "lecturer") entry.lecturers += 1;
    roleCounts.set(row.institution_id, entry);
  });

  type SubscriptionRow = {
    institution_id: string;
    status: string;
    ends_at: string | null;
    plan: { name: string } | null;
  };
  const subscriptionRows = (subscriptions ?? []) as unknown as SubscriptionRow[];
  const subscriptionMap = new Map(
    subscriptionRows.map((row) => [row.institution_id, row])
  );

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function href(overrides: Record<string, string | undefined>) {
    const merged = { q: q || undefined, status, ...overrides };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const queryString = search.toString();
    return queryString
      ? `/platform/institutions?${queryString}`
      : "/platform/institutions";
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Institutions"
        description={`${formatNumber(total)} institution${total === 1 ? "" : "s"} on the platform. Suspending an institution blocks every user in it from signing in.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-1 items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search name, slug or email"
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
            <Button
              key={item}
              asChild
              size="sm"
              variant={status === item ? "default" : "outline"}
            >
              <Link href={href({ status: item, page: undefined })} className="capitalize">
                {item}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {institutions && institutions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Lecturers</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((institution) => {
                const counts = roleCounts.get(institution.id) ?? {
                  students: 0,
                  lecturers: 0,
                };
                const subscription = subscriptionMap.get(institution.id);
                return (
                  <TableRow key={institution.id}>
                    <TableCell>
                      <Link
                        href={`/platform/institutions/${institution.id}`}
                        className="font-medium hover:text-brand-600"
                      >
                        {institution.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        /{institution.slug} · {institution.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadge[institution.status] ?? "muted"}
                        className="capitalize"
                      >
                        {institution.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatNumber(counts.students)}</TableCell>
                    <TableCell className="text-sm">{formatNumber(counts.lecturers)}</TableCell>
                    <TableCell>
                      {subscription ? (
                        <>
                          <p className="text-sm">{subscription.plan?.name ?? "—"}</p>
                          <Badge
                            variant={
                              subscription.status === "active"
                                ? "success"
                                : subscription.status === "trialing"
                                  ? "info"
                                  : "warning"
                            }
                            className="mt-1 capitalize"
                          >
                            {subscription.status}
                          </Badge>
                        </>
                      ) : (
                        <Badge variant="muted">None</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(institution.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <InstitutionActions
                        id={institution.id}
                        name={institution.name}
                        status={institution.status}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={Building2}
              title={q || status ? "No institutions match" : "No institutions yet"}
              description={
                q || status
                  ? "Try a different search term or status filter."
                  : "Institutions appear here after they register."
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
