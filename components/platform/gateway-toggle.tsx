"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setGatewayEnabled } from "@/lib/actions/platform";
import type { GatewayName } from "@/lib/payments/types";

export function GatewayToggle({
  gateway,
  enabled,
}: {
  gateway: GatewayName;
  enabled: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(enabled);
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        disabled={pending}
        onCheckedChange={(next) => {
          setChecked(next);
          startTransition(async () => {
            const result = await setGatewayEnabled(gateway, next);
            if (result.ok) {
              toast.success(result.message ?? "Gateway updated.");
              router.refresh();
            } else {
              setChecked(!next);
              toast.error(result.message ?? "Could not update the gateway.");
            }
          });
        }}
        aria-label={`Enable or disable ${gateway}`}
      />
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Power className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </div>
  );
}

export function GatewayRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Power />}
      Refresh status
    </Button>
  );
}
