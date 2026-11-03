"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setSessionState } from "@/lib/actions/attendance";
import type { SessionStatus } from "@/lib/types";

export function SessionControls({
  sessionId,
  status,
  compact = false,
}: {
  sessionId: string;
  status: SessionStatus;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState<"close" | "cancel" | null>(null);

  function run(action: "open" | "pause" | "resume" | "close" | "cancel") {
    startTransition(async () => {
      const result = await setSessionState(sessionId, action);
      if (!result.ok) {
        toast.error(result.message ?? "Could not update the session.");
        return;
      }
      toast.success(result.message ?? "Session updated.");
      setConfirm(null);
      router.refresh();
    });
  }

  const size = compact ? "sm" : "default";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === "scheduled" || status === "paused") && (
        <Button size={size} onClick={() => run(status === "paused" ? "resume" : "open")} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Play />}
          {status === "paused" ? "Resume" : "Open attendance"}
        </Button>
      )}
      {status === "open" && (
        <>
          <Button size={size} variant="outline" onClick={() => run("pause")} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Pause />}
            Pause
          </Button>
          <Button size={size} variant="destructive" onClick={() => setConfirm("close")} disabled={pending}>
            <Square /> Close
          </Button>
        </>
      )}
      {status !== "closed" && status !== "cancelled" && (
        <Button size={size} variant="ghost" onClick={() => setConfirm("cancel")} disabled={pending}>
          <Ban /> Cancel
        </Button>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "cancel" ? "Cancel this session?" : "Close attendance?"}</DialogTitle>
            <DialogDescription>
              {confirm === "cancel"
                ? "No further scans will be accepted. Recorded attendance is preserved."
                : "The scanner will stop accepting scans. All recorded attendance is preserved and remains reportable."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Keep open
            </Button>
            <Button
              variant="destructive"
              onClick={() => run(confirm === "cancel" ? "cancel" : "close")}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" />}
              {confirm === "cancel" ? "Cancel session" : "Close attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
