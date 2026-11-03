"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/admin/copy-button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState, FormAction } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";

export interface FieldDef {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "switch";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  options?: { value: string; label: string }[];
  help?: string;
  full?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export function EntityDialog({
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  triggerIcon,
  title,
  description,
  fields,
  hiddenValues,
  action,
  submitLabel = "Save",
}: {
  triggerLabel: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerIcon?: React.ReactNode;
  title: string;
  description?: string;
  fields: FieldDef[];
  hiddenValues?: Record<string, string | null | undefined>;
  action: FormAction;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(action, { ok: false });
  const [switches, setSwitches] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    fields.forEach((field) => {
      if (field.type === "switch") initial[field.name] = Boolean(field.defaultValue);
    });
    return initial;
  });

  const credentials =
    state.ok && state.data && (state.data.email || state.data.token)
      ? (state.data as { email?: string; password?: string; token?: string })
      : null;

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      router.refresh();
      if (!credentials) {
        setOpen(false);
      }
    } else if (state.message) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {triggerIcon ?? <Plus />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {credentials ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
              <p className="font-medium text-success">{state.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share these credentials through a secure channel. The user can
                change the password from their profile after signing in.
              </p>
            </div>
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
              {credentials.email && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">{credentials.email}</code>
                    <CopyButton value={credentials.email} />
                  </div>
                </div>
              )}
              {credentials.password && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Temporary password</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">{credentials.password}</code>
                    <CopyButton value={credentials.password} />
                  </div>
                </div>
              )}
              {credentials.token && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">New QR token</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">{credentials.token}</code>
                    <CopyButton value={credentials.token} />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {Object.entries(hiddenValues ?? {}).map(([key, value]) =>
              value ? <input key={key} type="hidden" name={key} value={value} /> : null
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const error = state.fieldErrors?.[field.name];
                const defaultValue =
                  field.defaultValue != null ? String(field.defaultValue) : undefined;

                return (
                  <div
                    key={field.name}
                    className={cn("space-y-1.5", field.full && "sm:col-span-2")}
                  >
                    <Label htmlFor={field.name}>{field.label}</Label>

                    {field.type === "textarea" ? (
                      <Textarea
                        id={field.name}
                        name={field.name}
                        required={field.required}
                        placeholder={field.placeholder}
                        defaultValue={defaultValue}
                        rows={3}
                      />
                    ) : field.type === "select" ? (
                      <Select name={field.name} defaultValue={defaultValue}>
                        <SelectTrigger id={field.name}>
                          <SelectValue placeholder={field.placeholder ?? "Select…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === "switch" ? (
                      <div className="flex h-9 items-center gap-2.5 rounded-lg border bg-background px-3">
                        <Switch
                          id={field.name}
                          checked={switches[field.name] ?? false}
                          onCheckedChange={(checked) =>
                            setSwitches((current) => ({ ...current, [field.name]: checked }))
                          }
                        />
                        <input
                          type="hidden"
                          name={field.name}
                          value={switches[field.name] ? "on" : "off"}
                        />
                        <span className="text-xs text-muted-foreground">
                          {switches[field.name] ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    ) : (
                      <Input
                        id={field.name}
                        name={field.name}
                        type={field.type ?? "text"}
                        required={field.required}
                        placeholder={field.placeholder}
                        defaultValue={defaultValue}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        autoComplete="off"
                      />
                    )}

                    {field.help && !error && (
                      <p className="text-[11px] text-muted-foreground">{field.help}</p>
                    )}
                    {error && <p className="text-[11px] text-destructive">{error}</p>}
                  </div>
                );
              })}
            </div>

            {state.message && !state.ok && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {state.message}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />}
                {pending ? "Saving…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
