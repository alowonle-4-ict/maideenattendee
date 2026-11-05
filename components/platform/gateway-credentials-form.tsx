"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Save, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearGatewayCredentials,
  saveGatewayCredentials,
} from "@/lib/actions/platform";
import type { GatewayCredentialSummary } from "@/lib/secrets/gateways";
import type { GatewayName } from "@/lib/payments/types";

const PLACEHOLDERS: Record<string, Record<string, string>> = {
  paystack: {
    secret_key: "sk_live_... or sk_test_...",
    public_key: "pk_live_... or pk_test_...",
  },
  flutterwave: {
    secret_key: "FLWSECK-... or FLWSECK_TEST-...",
    secret_hash: "The hash you set in the Flutterwave dashboard",
    public_key: "FLWPUBK-... or FLWPUBK_TEST-...",
  },
};

const OPTIONAL_NOTE = "Optional. Redirect checkout uses the secret key only.";

export function GatewayCredentialsForm({
  gateway,
  summary,
  encryptionReady,
}: {
  gateway: GatewayName;
  summary: GatewayCredentialSummary;
  encryptionReady: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(saveGatewayCredentials, { ok: false });
  const [clearing, startClear] = React.useTransition();

  const hasStored = summary.fields.some((field) => field.source === "stored");

  React.useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  if (!encryptionReady) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Credential storage is unavailable
        </p>
        <p className="mt-1 text-xs text-destructive-foreground/90">
          Set <code className="font-mono">SECRETS_ENCRYPTION_KEY</code> as a server-side
          environment variable and redeploy before pasting gateway keys here. Generate one with{" "}
          <code className="font-mono">
            node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(
            &apos;hex&apos;))&quot;
          </code>
          . Keys already set as environment variables continue to work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasStored && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0 text-success" />
          Encrypted on this server
          {summary.updatedAt
            ? ` \u00b7 updated ${new Date(summary.updatedAt).toLocaleString("en-NG")}`
            : ""}
        </p>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="gateway" value={gateway} />

        {summary.fields.map((field) => (
          <div key={field.field} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`${gateway}-${field.field}`}>
                {field.label}
                {!field.secret && (
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    optional
                  </span>
                )}
              </Label>
              <Badge
                variant={
                  field.source === "stored"
                    ? "success"
                    : field.source === "environment"
                      ? "muted"
                      : "outline"
                }
              >
                {field.source === "stored"
                  ? field.secret
                    ? `Stored ${field.preview}`
                    : "Stored"
                  : field.source === "environment"
                    ? field.secret
                      ? `Env ${field.preview}`
                      : "From environment"
                    : "Not set"}
              </Badge>
            </div>
            <Input
              id={`${gateway}-${field.field}`}
              name={field.field}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              placeholder={PLACEHOLDERS[gateway][field.field]}
            />
            {state.fieldErrors?.[field.field] ? (
              <p className="text-[11px] text-destructive">{state.fieldErrors[field.field]}</p>
            ) : field.source !== "none" ? (
              <p className="text-[11px] text-muted-foreground">
                Leave blank to keep the current value.
              </p>
            ) : (
              !field.secret && (
                <p className="text-[11px] text-muted-foreground">{OPTIONAL_NOTE}</p>
              )
            )}
            {!field.secret && field.source !== "none" && field.preview && (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {field.preview}
                </code>
                <CopyButton value={field.preview} label="Copy key" />
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {pending ? "Encrypting\u2026" : "Save credentials"}
          </Button>
          {hasStored && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={clearing}
              onClick={() =>
                startClear(async () => {
                  const result = await clearGatewayCredentials(gateway);
                  if (result.ok) {
                    toast.success(result.message ?? "Stored credentials removed.");
                    router.refresh();
                  } else {
                    toast.error(result.message ?? "Could not remove the stored credentials.");
                  }
                })
              }
            >
              {clearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Remove stored keys
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
