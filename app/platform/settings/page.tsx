import Link from "next/link";
import { CheckCircle2, ExternalLink, KeyRound, Settings, XCircle } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/dashboard/page-header";
import { PlatformSettingsForm } from "@/components/platform/platform-settings-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getGatewayAvailability } from "@/lib/payments";
import { secretsEncryptionConfigured } from "@/lib/secrets/crypto";
import { createClient } from "@/lib/supabase/server";

type PlatformSettingRow = { key: string; value: Record<string, unknown> };

export default async function PlatformSettingsPage() {
  const ctx = await requireAuth(["super_admin"]);
  const supabase = await createClient();

  const [{ data: settings }, gateways] = await Promise.all([
    supabase.from("platform_settings").select("key, value"),
    getGatewayAvailability(),
  ]);

  const rows = (settings ?? []) as unknown as PlatformSettingRow[];
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const trialValue = byKey.get("trial_days")?.value;
  const trialDays = typeof trialValue === "number" ? trialValue : 14;
  const supportValue = byKey.get("support_email")?.value;
  const supportEmail =
    typeof supportValue === "string" ? supportValue : "support@maideenattendee.app";

  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const paystack = gateways.find((gateway) => gateway.gateway === "paystack");
  const flutterwave = gateways.find((gateway) => gateway.gateway === "flutterwave");

  const checks = [
    { label: "Supabase URL and anon key", ok: isSupabaseConfigured() },
    { label: "Supabase service role key", ok: serviceRoleConfigured },
    { label: "Credential encryption key", ok: secretsEncryptionConfigured() },
    { label: "Paystack secret key", ok: Boolean(paystack?.configured) },
    { label: "Flutterwave secret key and hash", ok: Boolean(flutterwave?.configured) },
  ];

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Operations"
        title="Platform settings"
        description="Defaults that apply across every tenant, plus your own administrator account."
        actions={
          <Button asChild variant="outline">
            <Link href="/platform/gateways">
              Gateway controls <ExternalLink />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Platform defaults"
          description="Changes apply to new registrations and institution billing immediately."
        >
          <PlatformSettingsForm
            trialDays={trialDays}
            supportEmail={supportEmail}
            paystackEnabled={paystack?.enabled ?? true}
            flutterwaveEnabled={flutterwave?.enabled ?? true}
          />
        </SectionCard>

        <SectionCard
          title="Environment checks"
          description="Server-side configuration, never exposed to the browser."
        >
          <ul className="space-y-2.5">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{check.label}</span>
                {check.ok ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Set
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Missing
                  </Badge>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <KeyRound className="h-3.5 w-3.5" /> Two ways to supply gateway keys
            </p>
            <p className="mt-1">
              Enter them under Platform &rarr; Payment gateways (encrypted at rest with{" "}
              <code className="font-mono">SECRETS_ENCRYPTION_KEY</code>) or keep them in{" "}
              <code className="font-mono">.env.local</code>. Stored keys take precedence so you can
              rotate without a redeploy. Never commit secrets to source control. If a gateway is
              enabled without credentials, checkout is blocked with a clear configuration message.
            </p>
          </div>

          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/api/health" target="_blank">
              Open configuration health check
            </Link>
          </Button>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Your administrator account"
          description="Used on audit log entries for platform actions."
        >
          <ProfileForm
            fullName={ctx.profile?.full_name ?? "Platform Administrator"}
            phone={ctx.profile?.phone ?? null}
            email={ctx.profile?.email ?? ctx.user.email ?? ""}
          />
        </SectionCard>

        <SectionCard
          title="Operational notes"
          description="How platform-wide controls behave."
        >
          <ul className="space-y-3 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              Trial length is applied at institution registration. Existing trials are unchanged.
            </li>
            <li className="flex gap-2">
              <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              Disabling a gateway hides it from institution billing immediately. Existing
              subscriptions continue until their paid period ends.
            </li>
            <li className="flex gap-2">
              <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              Support email is shown on public contact screens and in billing failure messages.
            </li>
            <li className="flex gap-2">
              <Settings className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              Plan prices and limits are managed separately under Subscription plans.
            </li>
          </ul>
          <Button asChild variant="ghost" className="mt-4 w-full justify-start">
            <Link href="/platform/plans">Manage subscription plans</Link>
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}
