"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Clock3,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  ShieldCheck,
  ShieldOff,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  setInstitutionStatus,
  setUserActive,
  updateSubscriptionStatus,
  updateTicketStatus,
} from "@/lib/actions/platform";

type InstitutionStatus = "pending" | "active" | "suspended" | "deleted";
type SubscriptionStatus = "active" | "past_due" | "expired" | "cancelled";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export function InstitutionActions({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(next: InstitutionStatus, message: string) {
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const result = await setInstitutionStatus(id, next);
      if (result.ok) {
        toast.success(result.message ?? "Institution updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update the institution.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Manage ${name}`} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={status === "active"}
          onSelect={() => run("active", `Activate ${name}? Users will be able to sign in again.`)}
        >
          <CheckCircle2 /> Activate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={status === "suspended"}
          onSelect={() =>
            run("suspended", `Suspend ${name}? All users will be signed out and blocked from signing in.`)
          }
        >
          <PauseCircle /> Suspend
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={status === "pending"}
          onSelect={() => run("pending", `Mark ${name} as pending?`)}
        >
          <Clock3 /> Mark pending
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={status === "deleted"}
          onSelect={() =>
            run(
              "deleted",
              `Mark ${name} as deleted? This suspends access immediately. Data is retained for audit purposes.`
            )
          }
        >
          <Trash2 /> Mark deleted
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserActiveToggle({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={active ? "Deactivate user" : "Activate user"}
      aria-label={active ? "Deactivate user" : "Activate user"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setUserActive(userId, !active);
          if (result.ok) {
            toast.success(result.message ?? "User updated.");
            router.refresh();
          } else {
            toast.error(result.message ?? "Could not update the user.");
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : active ? (
        <ShieldOff />
      ) : (
        <ShieldCheck />
      )}
    </Button>
  );
}

export function SubscriptionActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(next: SubscriptionStatus, message: string) {
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const result = await updateSubscriptionStatus(id, next);
      if (result.ok) {
        toast.success(result.message ?? "Subscription updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update the subscription.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Manage subscription" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={status === "active"}
          onSelect={() => run("active", "Mark this subscription active?")}
        >
          <CheckCircle2 /> Active
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={status === "past_due"}
          onSelect={() => run("past_due", "Mark this subscription past due?")}
        >
          <Clock3 /> Past due
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={status === "expired"}
          onSelect={() =>
            run("expired", "Expire this subscription now? The institution will lose paid limits.")
          }
        >
          <XCircle /> Expire now
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={status === "cancelled"}
          onSelect={() => run("cancelled", "Cancel this subscription?")}
        >
          <Ban /> Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TicketStatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(next: TicketStatus) {
    startTransition(async () => {
      const result = await updateTicketStatus(id, next);
      if (result.ok) {
        toast.success(result.message ?? "Ticket updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update the ticket.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          Update
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ticket status</DropdownMenuLabel>
        <DropdownMenuItem disabled={status === "open"} onSelect={() => run("open")}>
          Open
        </DropdownMenuItem>
        <DropdownMenuItem disabled={status === "in_progress"} onSelect={() => run("in_progress")}>
          In progress
        </DropdownMenuItem>
        <DropdownMenuItem disabled={status === "resolved"} onSelect={() => run("resolved")}>
          Resolved
        </DropdownMenuItem>
        <DropdownMenuItem disabled={status === "closed"} onSelect={() => run("closed")}>
          Closed
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
