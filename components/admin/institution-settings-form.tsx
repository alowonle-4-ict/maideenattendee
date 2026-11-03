"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateInstitutionSettings } from "@/lib/actions/admin";

export interface InstitutionSettingsValues {
  attendance_threshold: number;
  late_after_minutes: number;
  allow_manual_qr: boolean;
  timezone: string;
  grace_period_days: number;
}

export function InstitutionSettingsForm({ values }: { values: InstitutionSettingsValues }) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(updateInstitutionSettings, { ok: false });
  const [manual, setManual] = React.useState(values.allow_manual_qr);

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
          <Label htmlFor="attendance_threshold">Attendance threshold (%)</Label>
          <Input
            id="attendance_threshold"
            name="attendance_threshold"
            type="number"
            min={0}
            max={100}
            defaultValue={values.attendance_threshold}
          />
          <p className="text-[11px] text-muted-foreground">
            Students below this percentage are flagged as at risk in reports.
          </p>
          {state.fieldErrors?.attendance_threshold && (
            <p className="text-[11px] text-destructive">{state.fieldErrors.attendance_threshold}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="late_after_minutes">Late after (minutes)</Label>
          <Input
            id="late_after_minutes"
            name="late_after_minutes"
            type="number"
            min={0}
            max={180}
            defaultValue={values.late_after_minutes}
          />
          <p className="text-[11px] text-muted-foreground">
            Scans after the opening time plus this many minutes are recorded as late.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue={values.timezone} placeholder="Africa/Lagos" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="grace_period_days">Subscription grace period (days)</Label>
          <Input
            id="grace_period_days"
            name="grace_period_days"
            type="number"
            min={0}
            max={90}
            defaultValue={values.grace_period_days}
          />
          <p className="text-[11px] text-muted-foreground">
            Days after expiry before premium features are restricted. Attendance records are never deleted.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Allow manual QR entry</p>
          <p className="text-xs text-muted-foreground">
            Lets lecturers type a student token when a camera cannot be used. Validation still happens on the server.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={manual} onCheckedChange={setManual} />
          <input type="hidden" name="allow_manual_qr" value={manual ? "on" : "off"} />
        </div>
      </div>

      {state.message && !state.ok && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
