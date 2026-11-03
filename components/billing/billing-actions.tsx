"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelSubscriptionRenewal, verifyPayment } from "@/lib/actions/billing";

export function VerifyPaymentButton({ reference }: { reference: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await verifyPayment(reference);
          if (result.ok) {
            toast.success(result.message ?? "Payment confirmed.");
            router.refresh();
          } else {
            toast.error(result.message ?? "Payment could not be confirmed.");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Verify
    </Button>
  );
}

export function CancelRenewalButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            "Cancel automatic renewal? Your plan remains active until the end of the current paid period."
          )
        ) {
          return;
        }
        startTransition(async () => {
          const result = await cancelSubscriptionRenewal();
          if (result.ok) {
            toast.success(result.message ?? "Renewal cancelled.");
            router.refresh();
          } else {
            toast.error(result.message ?? "Could not cancel renewal.");
          }
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <XCircle />}
      Cancel renewal
    </Button>
  );
}
