"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, updateProfile } from "@/lib/actions/profile";

export function ProfileForm({
  fullName,
  phone,
  email,
}: {
  fullName: string;
  phone: string | null;
  email: string;
}) {
  const router = useRouter();
  const [profileState, profileAction, profilePending] = React.useActionState(updateProfile, { ok: false });
  const [passwordState, passwordAction, passwordPending] = React.useActionState(changePassword, { ok: false });

  React.useEffect(() => {
    if (!profileState.message) return;
    if (profileState.ok) {
      toast.success(profileState.message);
      router.refresh();
    } else toast.error(profileState.message);
  }, [profileState, router]);

  React.useEffect(() => {
    if (!passwordState.message) return;
    if (passwordState.ok) toast.success(passwordState.message);
    else toast.error(passwordState.message);
  }, [passwordState]);

  return (
    <div className="space-y-6">
      <form action={profileAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" defaultValue={fullName} required />
            {profileState.fieldErrors?.full_name && (
              <p className="text-[11px] text-destructive">{profileState.fieldErrors.full_name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={phone ?? ""} placeholder="08030000000" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email</Label>
            <Input value={email} readOnly disabled />
            <p className="text-[11px] text-muted-foreground">
              Email changes are handled by your institution administrator to keep records accurate.
            </p>
          </div>
        </div>
        <Button type="submit" disabled={profilePending}>
          {profilePending ? <Loader2 className="animate-spin" /> : <Save />}
          Save profile
        </Button>
      </form>

      <div className="border-t pt-6">
        <form action={passwordAction} className="space-y-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4" /> Change password
            </p>
            <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
            </div>
          </div>
          <Button type="submit" variant="outline" disabled={passwordPending}>
            {passwordPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
