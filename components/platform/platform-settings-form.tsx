"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updatePlatformSettings } from "@/lib/actions/platform";

export function PlatformSettingsForm({
  trialDays,
  supportEmail,
  paystackEnabled,
  flutterwaveEnabled,
}: {
  trialDays: number;
  supportEmail: string;
  paystackEnabled: boolean;
  flutterwaveEnabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(updatePlatformSettings, { ok: false });
  const [paystack, setPaystack] = React.useState(paystackEnabled);
  const [flutterwave, setFlutterwave] = React.useState(flutterwaveEnabled);

  React.useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="trial_days">Trial length (days)</Label>
          <Input
            id="trial_days"
            name="trial_days"
            type="number"
            min={1}
            max={365}
            defaultValue={trialDays}
          />
          <p className="text-[11px] text-muted-foreground">
            Applied to institutions that register from now on.
          </p>
          {state.fieldErrors?.trial_days && (
            <p className="text-[11px] text-destructive">{state.fieldErrors.trial_days}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support_email">Support email</Label>
          <Input
            id="support_email"
            name="support_email"
            type="email"
            defaultValue={supportEmail}
          />
          {state.fieldErrors?.support_email && (
            <p className="text-[11px] text-destructive">{state.fieldErrors.support_email}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Paystack payments</p>
            <p className="text-xs text-muted-foreground">
              Institutions can pay for subscriptions with Paystack. Requires server credentials.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={paystack} onCheckedChange={setPaystack} />
            <input type="hidden" name="paystack" value={paystack ? "on" : "off"} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Flutterwave payments</p>
            <p className="text-xs text-muted-foreground">
              Institutions can pay for subscriptions with Flutterwave. Requires server credentials
              and a webhook secret hash.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={flutterwave} onCheckedChange={setFlutterwave} />
            <input type="hidden" name="flutterwave" value={flutterwave ? "on" : "off"} />
          </div>
        </div>
      </div>

      {state.message && !state.ok && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {pending ? "Saving…" : "Save platform settings"}
      </Button>
    </form>
  );
}
