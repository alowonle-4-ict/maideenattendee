import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Info,
  Receipt,
  XCircle,
} from "lucide-react";

import { VerifyPaymentButton } from "@/components/billing/billing-actions";
import { CopyButton } from "@/components/admin/copy-button";
import { EmptyState, PageHeader, SectionCard } from "@/components/dashboard/page-header";
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
import { requireInstitution } from "@/lib/auth";
import { getGatewayAvailability } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatNGN } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "info" | "destructive" | "muted"> = {
  success: "success",
  pending: "warning",
  failed: "destructive",
  abandoned: "muted",
  refunded: "info",
};

type PageProps = {
  searchParams: Promise<{ payment?: string; reference?: string; reason?: string }>;
};

function ResultBanner({
  payment,
  reference,
  reason,
}: {
  payment?: string;
  reference?: string;
  reason?: string;
}) {
  if (!payment) return null;

  const config = {
    success: {
      icon: CheckCircle2,
      className: "border-success/40 bg-success/10 text-success",
      title: "Payment confirmed",
      fallback: "Your subscription has been updated.",
    },
    pending: {
      icon: Info,
      className: "border-warning/40 bg-warning/10 text-warning",
      title: "Payment not confirmed yet",
      fallback:
        "The gateway has not confirmed this payment. It will update automatically when the webhook arrives.",
    },
    error: {
      icon: XCircle,
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      title: "Payment verification failed",
      fallback: "The payment could not be verified. No subscription was changed.",
    },
    unknown: {
      icon: AlertTriangle,
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      title: "Payment reference not found",
      fallback: "We could not match this payment to your institution.",
    },
  }[payment];

  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${config.className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{config.title}</p>
        <p className="mt-0.5 text-xs">{reason || config.fallback}</p>
        {reference && <p className="mt-1 font-mono text-[11px] opacity-80">{reference}</p>}
      </div>
    </div>
  );
}

export default async function AdminBillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();

  const [{ data: payments }, gateways] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, reference, amount, currency, gateway, status, created_at, paid_at, failure_reason, plan:subscription_plans(name)"
      )
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(100),
    getGatewayAvailability(),
  ]);

  const anyGatewayReady = gateways.some((gateway) => gateway.enabled && gateway.configured);

  return (
    <div className="page-shell">
      <PageHeader
        title="Billing history"
        description="Every subscription payment for your institution. Payments are verified with the gateway on the server before a subscription is activated."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/subscription">
              <CreditCard /> Manage subscription
            </Link>
          </Button>
        }
      />

      <ResultBanner
        payment={params.payment}
        reference={params.reference}
        reason={params.reason}
      />

      {!anyGatewayReady && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            No payment gateway has credentials on this deployment. Ask the platform owner to enter
            them under Platform &rarr; Payment gateways. No payment will be simulated.
          </p>
        </div>
      )}

      <SectionCard
        title="Payments"
        description={
          payments && payments.length > 0
            ? `${payments.length} most recent payment${payments.length === 1 ? "" : "s"}.`
            : undefined
        }
        contentClassName="p-0"
      >
        {payments && payments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const plan = payment.plan as unknown as { name: string } | null;
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(payment.created_at)}
                      {payment.paid_at && (
                        <p className="text-[11px]">Paid {formatDateTime(payment.paid_at)}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{plan?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{payment.gateway}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatNGN(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[payment.status] ?? "muted"}
                        className="capitalize"
                      >
                        {payment.status}
                      </Badge>
                      {payment.failure_reason && (
                        <p className="mt-1 max-w-[220px] text-[11px] text-destructive">
                          {payment.failure_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="max-w-[160px] truncate text-[11px]">{payment.reference}</code>
                        <CopyButton value={payment.reference} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.status !== "success" && (
                        <VerifyPaymentButton reference={payment.reference} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={Receipt}
              title="No payments yet"
              description="When you purchase or renew a subscription, the payment and its server-verified status appear here."
              action={
                <Button asChild>
                  <Link href="/admin/subscription">View plans</Link>
                </Button>
              }
            />
          </div>
        )}
      </SectionCard>

      <div className="mt-6 flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          A payment is only marked successful after the server verifies it directly with the
          gateway. Redirect results and webhook payloads are never trusted on their own. If a
          payment looks stuck, use Verify to re-check it with the gateway.
        </p>
      </div>
    </div>
  );
}
