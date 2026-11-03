import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Webhook,
  XCircle,
} from "lucide-react";

import { CopyButton } from "@/components/admin/copy-button";
import { PageHeader, SectionCard, StatCard } from "@/components/dashboard/page-header";
import { GatewayRefreshButton, GatewayToggle } from "@/components/platform/gateway-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { getGatewayAvailability } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, relativeTime } from "@/lib/utils";

type WebhookRow = {
  id: string;
  gateway: string;
  event_id: string | null;
  event_type: string | null;
  signature_valid: boolean;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
};

export default async function PlatformGatewaysPage() {
  await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const [gateways, { data: events }] = await Promise.all([
    getGatewayAvailability(),
    supabase
      .from("payment_webhook_events")
      .select(
        "id, gateway, event_id, event_type, signature_valid, processed_at, processing_error, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const webhookRows = (events ?? []) as unknown as WebhookRow[];
  const configuredCount = gateways.filter((gateway) => gateway.configured).length;
  const enabledCount = gateways.filter((gateway) => gateway.enabled).length;
  const signatureFailures = webhookRows.filter((row) => !row.signature_valid).length;

  const endpoints = [
    {
      label: "Paystack webhook",
      url: `${env.appUrl}/api/webhooks/paystack`,
      note: "Set this as the Paystack webhook URL. Requests are validated with the PAYSTACK_SECRET_KEY HMAC signature.",
    },
    {
      label: "Flutterwave webhook",
      url: `${env.appUrl}/api/webhooks/flutterwave`,
      note: "Set this as the Flutterwave webhook URL and use FLUTTERWAVE_SECRET_HASH as the secret hash.",
    },
    {
      label: "Checkout callback",
      url: `${env.appUrl}/api/payments/callback`,
      note: "Redirect target after checkout. The page re-verifies the transaction with the gateway before showing success.",
    },
  ];

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Revenue"
        title="Payment gateways"
        description="Control which gateways institutions can use. Enabling a gateway does not replace server credentials — checkout still refuses to start if keys are missing."
        actions={<GatewayRefreshButton />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Configured"
          value={`${configuredCount} / ${gateways.length}`}
          hint="Server credentials present"
          icon={ShieldCheck}
          tone={configuredCount === gateways.length ? "success" : "warning"}
        />
        <StatCard
          label="Enabled"
          value={`${enabledCount} / ${gateways.length}`}
          hint="Available on institution billing"
          icon={CheckCircle2}
          tone={enabledCount > 0 ? "brand" : "warning"}
        />
        <StatCard
          label="Signature failures"
          value={signatureFailures}
          hint="In the last 25 webhook deliveries"
          icon={AlertTriangle}
          tone={signatureFailures > 0 ? "destructive" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {gateways.map((gateway) => (
          <SectionCard
            key={gateway.gateway}
            title={gateway.label}
            description={
              gateway.gateway === "paystack"
                ? "Card, bank transfer and USSD payments in NGN."
                : "Card and bank transfer payments in NGN."
            }
            actions={<GatewayToggle gateway={gateway.gateway} enabled={gateway.enabled} />}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={gateway.enabled ? "success" : "muted"}>
                  {gateway.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Badge variant={gateway.configured ? "success" : "destructive"}>
                  {gateway.configured ? "Credentials configured" : "Missing credentials"}
                </Badge>
              </div>

              {!gateway.configured && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Checkout is blocked for {gateway.label}
                  </p>
                  <p className="mt-1">
                    Add these server-side environment variables, then redeploy:{" "}
                    <code className="font-mono">{gateway.missing.join(", ")}</code>.
                  </p>
                </div>
              )}

              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  Amounts are initialized server-side from the plan price in NGN.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  Every success redirect is re-verified with the gateway before access is extended.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  Webhooks reject unsigned or tampered payloads and are processed idempotently.
                </li>
              </ul>
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard
        className="mt-6"
        title="Webhook endpoints"
        description="Configure these URLs in each gateway dashboard."
      >
        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <div
              key={endpoint.label}
              className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{endpoint.label}</p>
                <code className="mt-1 block break-all text-[11px] text-muted-foreground">
                  {endpoint.url}
                </code>
                <p className="mt-1 text-[11px] text-muted-foreground">{endpoint.note}</p>
              </div>
              <CopyButton value={endpoint.url} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        className="mt-6"
        title="Recent webhook deliveries"
        description="A delivery is successful when the signature is valid and the payment settles exactly once."
        contentClassName="p-0"
      >
        {webhookRows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gateway</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhookRows.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-sm capitalize">{event.gateway}</TableCell>
                  <TableCell>
                    <p className="text-sm">{event.event_type ?? "—"}</p>
                    {event.event_id && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {event.event_id}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {event.signature_valid ? (
                      <Badge variant="success" className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> Valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> Invalid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.processing_error ? (
                      <span className="text-destructive">{event.processing_error}</span>
                    ) : event.processed_at ? (
                      <span className="text-success">Settled</span>
                    ) : (
                      <span className="text-muted-foreground">Received</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {formatDateTime(event.created_at)}
                    <p>{relativeTime(event.created_at)}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Webhook className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">No webhook deliveries yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Deliveries appear here after a gateway calls the webhook endpoint. If payments
              succeed but this stays empty, check the webhook URL in the gateway dashboard.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
