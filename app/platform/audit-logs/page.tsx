import { ScrollText, Search } from "lucide-react";

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
import { formatDateTime, formatNumber, relativeTime } from "@/lib/utils";

const PAGE_SIZE = 30;

type AuditRow = {
  id: string;
  institution_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  institution: { name: string; slug: string } | null;
};

type PageProps = {
  searchParams: Promise<{ q?: string; entity?: string; page?: string }>;
};

export default async function PlatformAuditLogsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const q = (params.q ?? "").replace(/[%,()]/g, " ").trim();
  const entity = (params.entity ?? "").replace(/[^a-z_]/gi, "");
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("audit_logs")
    .select(
      "id, institution_id, actor_email, action, entity_type, entity_id, metadata, ip, created_at, institution:institutions(name, slug)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (entity) query = query.eq("entity_type", entity);
  if (q) {
    query = query.or(
      `action.ilike.%${q}%,actor_email.ilike.%${q}%,entity_type.ilike.%${q}%,entity_id.ilike.%${q}%`
    );
  }

  const { data, count } = await query;
  const logs = (data ?? []) as unknown as AuditRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function href(overrides: Record<string, string | undefined>) {
    const merged = { q: q || undefined, entity: entity || undefined, ...overrides };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const queryString = search.toString();
    return queryString ? `/platform/audit-logs?${queryString}` : "/platform/audit-logs";
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Operations"
        title="Audit logs"
        description="Immutable record of platform and institution administration actions. Attendance-level corrections are stored with each attendance record."
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {entity && <input type="hidden" name="entity" value={entity} />}
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search action, actor or entity"
            className="pl-8"
          />
        </div>
        <Input
          name="entity"
          defaultValue={entity}
          placeholder="Entity type (e.g. payment)"
          className="w-56"
        />
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {(q || entity) && (
          <Button asChild variant="ghost">
            <a href="/platform/audit-logs">Clear</a>
          </Button>
        )}
      </form>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {logs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Metadata</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const metadata = log.metadata ?? {};
                const entries = Object.entries(metadata);
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <p className="font-medium capitalize">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      {log.ip && (
                        <p className="font-mono text-[10px] text-muted-foreground">{log.ip}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actor_email ?? "System"}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{log.entity_type ?? "—"}</p>
                      {log.entity_id && (
                        <p className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground">
                          {log.entity_id}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.institution ? (
                        log.institution.name
                      ) : (
                        <span className="text-muted-foreground">Platform</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entries.length ? (
                        <div className="flex max-w-[280px] flex-wrap gap-1">
                          {entries.slice(0, 3).map(([key, value]) => (
                            <Badge key={key} variant="muted" className="font-normal">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                          {entries.length > 3 && (
                            <Badge variant="muted" className="font-normal">
                              +{entries.length - 3} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                      {formatDateTime(log.created_at)}
                      <p>{relativeTime(log.created_at)}</p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={ScrollText}
            title="No audit entries match"
            description="Administrative actions are recorded automatically, including plan changes, payment settlements and status updates."
            action={
              <Button asChild variant="outline">
                <a href="/platform/audit-logs">Clear filters</a>
              </Button>
            }
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Page {page} of {totalPages} · {formatNumber(total)} entries
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" aria-disabled={page <= 1}>
              <a href={href({ page: String(Math.max(1, page - 1)) })}>Previous</a>
            </Button>
            <Button asChild size="sm" variant="outline" aria-disabled={page >= totalPages}>
              <a href={href({ page: String(Math.min(totalPages, page + 1)) })}>Next</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
