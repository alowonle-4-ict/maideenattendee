import Link from "next/link";
import { Search, Users } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { UserActiveToggle } from "@/components/platform/actions";
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
const ROLES = ["super_admin", "institution_admin", "lecturer", "student"] as const;

const roleBadge: Record<
  string,
  "info" | "warning" | "muted" | "success"
> = {
  super_admin: "success",
  institution_admin: "info",
  lecturer: "warning",
  student: "muted",
};

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  matric_number: string | null;
  staff_number: string | null;
  is_active: boolean;
  created_at: string;
  institution: { name: string; slug: string } | null;
  user_roles: { role: string }[];
};

type PageProps = {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
};

export default async function PlatformUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const q = (params.q ?? "").replace(/[%,()]/g, " ").trim();
  const role = ROLES.includes(params.role as (typeof ROLES)[number])
    ? (params.role as (typeof ROLES)[number])
    : undefined;
  const status =
    params.status === "active" || params.status === "inactive" ? params.status : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, matric_number, staff_number, is_active, created_at, institution:institutions(name, slug), user_roles!inner(role)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (role) query = query.eq("user_roles.role", role);
  if (status) query = query.eq("is_active", status === "active");
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,matric_number.ilike.%${q}%`);

  const { data, count } = await query;
  const users = (data ?? []) as unknown as UserRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function href(overrides: Record<string, string | undefined>) {
    const merged = { q: q || undefined, role, status, ...overrides };
    const search = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const queryString = search.toString();
    return queryString ? `/platform/users?${queryString}` : "/platform/users";
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Platform"
        title="Users"
        description={`${formatNumber(total)} account${total === 1 ? "" : "s"} across every tenant. Deactivating a user blocks sign-in without deleting their records.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-1 items-center gap-2">
          {role && <input type="hidden" name="role" value={role} />}
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search name, email or matric number"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          <Button asChild size="sm" variant={!role ? "default" : "outline"}>
            <Link href={href({ role: undefined, page: undefined })}>All roles</Link>
          </Button>
          {ROLES.map((item) => (
            <Button key={item} asChild size="sm" variant={role === item ? "default" : "outline"}>
              <Link href={href({ role: item, page: undefined })}>
                {item.replace("_", " ")}
              </Link>
            </Button>
          ))}
        </div>

        <div className="flex gap-1.5">
          <Button asChild size="sm" variant={status === "active" ? "default" : "outline"}>
            <Link href={href({ status: "active", page: undefined })}>Active</Link>
          </Button>
          <Button asChild size="sm" variant={status === "inactive" ? "default" : "outline"}>
            <Link href={href({ status: "inactive", page: undefined })}>Inactive</Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {users.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={!user.is_active ? "opacity-60" : undefined}>
                  <TableCell>
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">{user.email}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.user_roles.map((entry) => (
                        <Badge
                          key={entry.role}
                          variant={roleBadge[entry.role] ?? "muted"}
                          className="capitalize"
                        >
                          {entry.role.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.institution ? (
                      user.institution.name
                    ) : (
                      <span className="text-muted-foreground">Platform</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {user.matric_number ?? user.staff_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "success" : "destructive"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <UserActiveToggle userId={user.id} active={user.is_active} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Users}
            title="No users match"
            description="Try a different search term or remove the role and status filters."
            action={
              <Button asChild variant="outline">
                <Link href="/platform/users">Clear filters</Link>
              </Button>
            }
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Page {page} of {totalPages} · {formatNumber(total)} users
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
