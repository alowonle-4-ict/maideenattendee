"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";

import { registerInstitution, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: AuthState = { ok: false };

export function RegisterForm({
  plans,
  defaultPlan,
}: {
  plans: { slug: string; name: string; price_ngn: number }[];
  defaultPlan?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(
    registerInstitution,
    initialState
  );
  const [showPassword, setShowPassword] = React.useState(false);
  const [plan, setPlan] = React.useState(defaultPlan ?? plans[0]?.slug ?? "starter");

  React.useEffect(() => {
    if (state.ok && state.redirect) {
      if (!state.message) {
        router.replace(state.redirect);
      } else {
        router.replace("/login");
      }
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="institutionName">Institution name</Label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="institutionName"
            name="institutionName"
            required
            placeholder="University of Lagos"
            className="pl-9"
          />
        </div>
        {state.fieldErrors?.institutionName && (
          <p className="text-xs text-destructive">{state.fieldErrors.institutionName}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminName">Your full name</Label>
        <Input
          id="adminName"
          name="adminName"
          required
          autoComplete="name"
          placeholder="Amina Bello"
        />
        {state.fieldErrors?.adminName && (
          <p className="text-xs text-destructive">{state.fieldErrors.adminName}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="admin@university.edu.ng"
          />
          {state.fieldErrors?.email && (
            <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="0803 000 0000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan">Plan</Label>
        <Select name="plan" value={plan} onValueChange={setPlan}>
          <SelectTrigger id="plan">
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((option) => (
              <SelectItem key={option.slug} value={option.slug}>
                {option.name} — ₦{option.price_ngn.toLocaleString("en-NG")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Every plan starts with a 14-day trial. No card required.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {state.fieldErrors?.password && (
            <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="Repeat password"
          />
          {state.fieldErrors?.confirmPassword && (
            <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword}</p>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border p-3 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="font-medium text-foreground underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-foreground underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {state.message && (
        <div
          role="alert"
          className={
            state.ok
              ? "rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success"
              : "rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {state.message}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Creating institution…" : "Create institution account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Sign in
        </Link>
      </p>
    </form>
  );
}
