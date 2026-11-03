"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { togglePlanActive } from "@/lib/actions/platform";

export function PlanActiveToggle({
  id,
  active,
  name,
}: {
  id: string;
  active: boolean;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={active ? `Hide ${name}` : `Publish ${name}`}
      title={active ? "Hide from institutions" : "Publish to institutions"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await togglePlanActive(id);
          if (result.ok) {
            toast.success(result.message ?? "Plan updated.");
            router.refresh();
          } else {
            toast.error(result.message ?? "Could not update the plan.");
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : active ? (
        <EyeOff />
      ) : (
        <Eye />
      )}
    </Button>
  );
}
