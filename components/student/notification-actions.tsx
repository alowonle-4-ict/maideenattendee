"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markNotificationRead } from "@/lib/actions/notifications";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markNotificationRead(id);
          if (!result.ok) {
            toast.error(result.message ?? "Could not update this notification.");
            return;
          }
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Check />}
      Mark read
    </Button>
  );
}
