"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startCheckout } from "@/lib/actions/billing";
import type { GatewayAvailability } from "@/lib/payments/types";

export function PlanCheckout({
  planId,
  planName,
  gateways,
}: {
  planId: string;
  planName: string;
  gateways: GatewayAvailability[];
}) {
  const [pending, setPending] = React.useState<string | null>(null);

  async function checkout(gateway: GatewayAvailability["gateway"]) {
    setPending(gateway);
    try {
      const result = await startCheckout(planId, gateway);
      if (!result.ok || !result.url) {
        toast.error(result.message ?? "Could not start checkout.");
        return;
      }
      window.location.assign(result.url);
    } catch {
      toast.error("Could not start checkout. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {gateways.map((gateway) => {
        const unavailable = !gateway.enabled || !gateway.configured;
        const reason = !gateway.enabled
          ? `${gateway.label} is disabled by the platform administrator.`
          : `Not configured: ${gateway.missing.join(", ")}`;
        return (
          <Button
            key={gateway.gateway}
            className="w-full"
            variant={gateway.gateway === "paystack" ? "default" : "outline"}
            disabled={unavailable || pending !== null}
            title={unavailable ? reason : undefined}
            onClick={() => checkout(gateway.gateway)}
          >
            {pending === gateway.gateway ? <Loader2 className="animate-spin" /> : <CreditCard />}
            {pending === gateway.gateway
              ? "Opening checkout…"
              : `Pay for ${planName} with ${gateway.label}`}
          </Button>
        );
      })}
      {gateways.some((gateway) => !gateway.enabled || !gateway.configured) && (
        <p className="text-[11px] text-muted-foreground">
          {gateways
            .filter((gateway) => !gateway.enabled || !gateway.configured)
            .map((gateway) =>
              !gateway.enabled
                ? `${gateway.label} is disabled by the platform administrator.`
                : `${gateway.label} needs ${gateway.missing.join(", ")}.`
            )
            .join(" ")}
        </p>
      )}
    </div>
  );
}
