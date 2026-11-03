"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { requestPasswordReset, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = { ok: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = React.useActionState(
    requestPasswordReset,
    initialState
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Account email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@university.edu.ng"
        />
      </div>
      {state.message && (
        <div
          role="status"
          className={
            state.ok
              ? "rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success"
              : "rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {state.message}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Sending link…" : "Send reset link"}
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link href="/login">
          <ArrowLeft /> Back to sign in
        </Link>
      </Button>
    </form>
  );
}
