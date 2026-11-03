"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, QrCode, RotateCcw, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/admin/copy-button";
import { QrCard } from "@/components/admin/qr-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { regenerateQr, setLecturerActive, setStudentActive } from "@/lib/actions/admin";
import type { ActionState } from "@/lib/actions/admin";

type Runner = (id: string) => Promise<ActionState>;

export function RowAction({
  action,
  id,
  label,
  icon,
  confirm,
  size = "icon-sm",
  className,
}: {
  action: Runner;
  id: string;
  label: string;
  icon: React.ReactNode;
  confirm?: { title: string; description: string; confirmLabel: string; destructive?: boolean };
  size?: "icon-sm" | "sm";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function run() {
    setPending(true);
    const result = await action(id);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message ?? "The action could not be completed.");
      return;
    }
    toast.success(result.message ?? "Done.");
    setOpen(false);
    router.refresh();
  }

  const trigger = (
    <Button
      variant="ghost"
      size={size}
      className={className}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={confirm ? undefined : run}
    >
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {size === "sm" && <span>{label}</span>}
    </Button>
  );

  if (!confirm) return trigger;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{confirm.title}</DialogTitle>
          <DialogDescription>{confirm.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={confirm.destructive ? "destructive" : "default"}
            onClick={run}
            disabled={pending}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirm.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ToggleActiveButton({
  id,
  active,
  kind,
}: {
  id: string;
  active: boolean;
  kind: "student" | "lecturer";
}) {
  const action: Runner = React.useCallback(
    (targetId) =>
      kind === "student" ? setStudentActive(targetId, !active) : setLecturerActive(targetId, !active),
    [active, kind]
  );

  return (
    <RowAction
      action={action}
      id={id}
      label={active ? "Deactivate" : "Activate"}
      icon={active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      confirm={
        active
          ? {
              title: `Deactivate this ${kind}?`,
              description:
                "Their records are preserved. They will be blocked from signing in and their QR code will stop being accepted until reactivated.",
              confirmLabel: "Deactivate",
              destructive: true,
            }
          : undefined
      }
    />
  );
}

export function QrCredentialDialog({
  student,
  token,
  institutionName,
}: {
  student: { id: string; name: string; matric: string | null };
  token: string | null;
  institutionName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [currentToken, setCurrentToken] = React.useState(token);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setCurrentToken(token), [token]);

  async function regenerate() {
    setPending(true);
    const result = await regenerateQr(student.id);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message ?? "Could not regenerate the QR credential.");
      return;
    }
    setCurrentToken(String(result.data?.token ?? ""));
    toast.success("A new QR credential has been issued. The previous code is now revoked.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="View QR code" title="View QR code">
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Student QR credential</DialogTitle>
          <DialogDescription>
            This opaque token is permanent unless you regenerate it. It contains no personal data.
          </DialogDescription>
        </DialogHeader>

        {currentToken ? (
          <div className="space-y-4">
            <QrCard
              token={currentToken}
              name={student.name}
              matric={student.matric}
              institutionName={institutionName}
            />
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <code className="flex-1 break-all font-mono text-[10px]">{currentToken}</code>
              <CopyButton value={currentToken} />
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No QR credential exists for this student yet. Regenerate to issue one.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={regenerate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Regenerate
          </Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
