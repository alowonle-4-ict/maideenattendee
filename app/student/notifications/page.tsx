import Link from "next/link";
import { ArrowRight, Bell, BellRing } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/dashboard/page-header";
import { MarkReadButton } from "@/components/student/notification-actions";
import { MarkAllReadButton } from "@/components/student/mark-all-read-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, relativeTime } from "@/lib/utils";

const typeVariant: Record<string, "info" | "success" | "warning" | "destructive"> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "destructive",
  attendance: "info",
  billing: "warning",
};

export default async function StudentNotificationsPage() {
  const ctx = await requireAuth(["student"]);
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, type, link, read_at, created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const items = notifications ?? [];
  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Updates about attendance sessions, corrections and your institution."
        actions={
          <MarkAllReadButton disabled={unread === 0} />
        }
      />

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={
                item.read_at
                  ? "rounded-xl border bg-card p-5 shadow-card"
                  : "rounded-xl border border-brand-200 bg-brand-50/40 p-5 shadow-card dark:border-brand-900 dark:bg-brand-950/30"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    {item.read_at ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4 text-brand-600" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <Badge variant={typeVariant[item.type] ?? "muted"} className="capitalize">
                        {item.type}
                      </Badge>
                      {!item.read_at && <Badge variant="default">New</Badge>}
                    </div>
                    {item.body && (
                      <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
                        {item.body}
                      </p>
                    )}
                    <p
                      className="mt-2 text-[11px] text-muted-foreground"
                      title={formatDateTime(item.created_at)}
                    >
                      {relativeTime(item.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.link && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={item.link}>
                        Open <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  {!item.read_at && <MarkReadButton id={item.id} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Announcements, attendance corrections and billing updates will appear here."
          action={
            <Button asChild variant="outline">
              <Link href="/student">Back to dashboard</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
