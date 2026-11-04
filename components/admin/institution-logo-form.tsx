"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/actions/admin";
import { updateInstitutionLogo } from "@/lib/actions/admin";

export function InstitutionLogoForm({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(updateInstitutionLogo, {
    ok: false,
  } as ActionState);
  const [preview, setPreview] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  React.useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  const display = preview ?? logoUrl;

  return (
    <form action={action} className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-muted">
        {display ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={display} alt="Institution logo preview" className="h-full w-full object-contain p-2" />
        ) : (
          <Building2 className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="institution-logo">Logo image</Label>
          <Input
            ref={inputRef}
            id="institution-logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            PNG, JPEG or WebP up to 2 MB. Square images work best. The logo appears
            in the dashboard header for administrators, lecturers and students.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="intent" value="upload" disabled={pending} size="sm">
            {pending ? <Loader2 className="animate-spin" /> : <Upload />}
            {pending ? "Saving…" : "Upload logo"}
          </Button>
          {logoUrl && (
            <Button
              type="submit"
              name="intent"
              value="remove"
              variant="outline"
              size="sm"
              disabled={pending}
            >
              <Trash2 /> Remove
            </Button>
          )}
        </div>

        {state.message && !state.ok && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
