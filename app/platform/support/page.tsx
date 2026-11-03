import Link from "next/link";
import { LifeBuoy, Search } from "lucide-react";

import { EmptyState, PageHeader, StatCard } from "@/components/dashboard/page-header";
import { TicketStatusActions } from "@/components/platform/actions";
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
import { formatDateTime, formatNumber, relativeTime } from "@/lib/utils";

const PAGE_SIZE = 25;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

const statusBadge: Record<string, "warning" | "info" | "success" | "muted"> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "muted",
};

const priorityBadge: Record<string, "muted" | "info" | "warning" | "destructive"> = {
  low: "muted",
  normal: "info",
  high: "warning",
  urgent: "destructive",
};

type TicketRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  institution: { id: string; name: string; slug: string } | null;
  creator: { full_name: string; email: string } | null;
};

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
};

export default async function PlatformSupportPage({ searchParams }: PageProps) {
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
    .from("support_tickets")
    .select(
      "id, subject, body, status, priority, created_at, updated_at, institution:institutions(id, name, slug), creator:profiles!support_tickets_created_by_fkey(full_name, email)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`subject.ilike.%${q}%,body.ilike.%${q}%`);

  const { data, count } = await query;
  const tickets = (data ?? []) as unknown as TicketRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [{ count: openCount }, { count: inProgressCount }, { count: urgentCount }] =
    await Promise.all([
      supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"])
        .in("priority", ["high", "urgent"]),
    ]);

  function href(overrides: Record<string, string | undefined>) {
    const merged = { status, q: q || undefined, ...overrides };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const queryString = search.toString();
    return queryString ? `/platform/support?${queryString}` : "/platform/support";
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Operations"
        title="Support tickets"
        description="Messages submitted from the public contact form and institution support screens. Reply by email, then update the ticket status here."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={formatNumber(openCount ?? 0)} icon={LifeBuoy} tone="warning" />
        <StatCard
          label="In progress"
          value={formatNumber(inProgressCount ?? 0)}
          icon={LifeBuoy}
          tone="brand"
        />
        <StatCard
          label="High priority"
          value={formatNumber(urgentCount ?? 0)}
          hint="Open or in progress"
          icon={LifeBuoy}
          tone={(urgentCount ?? 0) > 0 ? "destructive" : "default"}
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
              placeholder="Search subject or message"
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
              <Link href={href({ status: item, page: undefined })}>
                {item.replace("_", " ")}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {tickets.length ? (
          tickets.map((ticket) => (
            <details
              key={ticket.id}
              className="group rounded-xl border bg-card shadow-card open:ring-1 open:ring-border"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{ticket.subject}</p>
                    <Badge
                      variant={statusBadge[ticket.status] ?? "muted"}
                      className="capitalize"
                    >
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    <Badge
                      variant={priorityBadge[ticket.priority] ?? "muted"}
                      className="capitalize"
                    >
                      {ticket.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {ticket.institution ? (
                      <Link
                        href={`/platform/institutions/${ticket.institution.id}`}
                        className="hover:text-brand-600"
                      >
                        {ticket.institution.name}
                      </Link>
                    ) : (
                      "Public contact form"
                    )}
                    {ticket.creator ? ` · ${ticket.creator.full_name}` : ""} ·{" "}
                    {relativeTime(ticket.created_at)}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground group-open:hidden">
                  Open
                </span>
                <TicketStatusActions id={ticket.id} status={ticket.status} />
              </summary>

              <div className="border-t px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {ticket.body}
                </p>
                <div className="mt-4 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">Submitted:</span>{" "}
                    {formatDateTime(ticket.created_at)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Last updated:</span>{" "}
                    {formatDateTime(ticket.updated_at)}
                  </p>
                  {ticket.creator && (
                    <p>
                      <span className="font-medium text-foreground">Contact:</span>{" "}
                      <a className="hover:text-brand-600" href={`mailto:${ticket.creator.email}`}>
                        {ticket.creator.email}
                      </a>
                    </p>
                  )}
                  {ticket.institution && (
                    <p>
                      <span className="font-medium text-foreground">Institution:</span>{" "}
                      {ticket.institution.name} (/{ticket.institution.slug})
                    </p>
                  )}
                </div>
              </div>
            </details>
          ))
        ) : (
          <EmptyState
            icon={LifeBuoy}
            title="No tickets match"
            description="Messages sent through the contact form arrive here with the sender's details."
            action={
              <Button asChild variant="outline">
                <Link href="/platform/support">Clear filters</Link>
              </Button>
            }
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Page {page} of {totalPages} · {formatNumber(total)} tickets
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
