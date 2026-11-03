"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { submitContact, type ContactState } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ContactState = { ok: false, message: "" };

export function ContactForm() {
  const [state, action, pending] = React.useActionState(submitContact, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required autoComplete="name" placeholder="Amina Bello" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@university.edu.ng" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="institution">Institution</Label>
        <Input id="institution" name="institution" placeholder="University of Lagos" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">How can we help?</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={5}
          placeholder="Tell us about your institution, the number of students, and what you'd like to achieve."
        />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state.message && (
        <div
          role="status"
          className={
            state.ok
              ? "flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success"
              : "rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {state.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{state.message}</span>
        </div>
      )}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
