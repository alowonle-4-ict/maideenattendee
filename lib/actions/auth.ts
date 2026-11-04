"use server";

import { z } from "zod";

import { ROLE_HOME } from "@/lib/auth";
import { env, isSupabaseConfigured } from "@/lib/env";
import { slugify } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export interface AuthState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  redirect?: string;
}

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the server.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return {
      ok: false,
      message:
        error?.message.toLowerCase().includes("invalid")
          ? "Incorrect email or password."
          : error?.message ?? "Unable to sign in.",
    };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (roleError) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        "We couldn't load your account permissions. Please try again in a moment. If it keeps happening, contact your administrator.",
    };
  }

  if (!roleRow?.role) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        "Your account has no role assigned. Contact your institution administrator.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active, institution_id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        "We couldn't verify your account status. Please try again in a moment.",
    };
  }

  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    return { ok: false, message: "This account has been deactivated." };
  }

  if (roleRow.role !== "super_admin" && profile) {
    const { data: institution, error: institutionError } = await supabase
      .from("institutions")
      .select("status")
      .eq("id", profile.institution_id)
      .maybeSingle();

    if (institutionError) {
      await supabase.auth.signOut();
      return {
        ok: false,
        message:
          "We couldn't verify your institution's status. Please try again in a moment.",
      };
    }

    if (institution?.status === "suspended" || institution?.status === "deleted") {
      await supabase.auth.signOut();
      return {
        ok: false,
        message: "This institution is suspended. Contact the platform administrator.",
      };
    }
  }

  return {
    ok: true,
    redirect: ROLE_HOME[roleRow.role as AppRole] ?? "/dashboard",
  };
}

const registerSchema = z
  .object({
    institutionName: z.string().trim().min(2, "Enter the institution name").max(160),
    adminName: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().trim().email("Enter a valid email address"),
    phone: z.string().trim().max(30).optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72),
    confirmPassword: z.string(),
    plan: z.string().trim().optional(),
    terms: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.terms === "on", {
    message: "Accept the terms of service to continue",
    path: ["terms"],
  });

export async function registerInstitution(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    institutionName: formData.get("institutionName"),
    adminName: formData.get("adminName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    plan: formData.get("plan") || undefined,
    terms: formData.get("terms") ?? undefined,
  });

  if (!parsed.success) {
    const flat: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      if (issue.path[0]) flat[String(issue.path[0])] = issue.message;
    });
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form.",
      fieldErrors: flat,
    };
  }

  if (!isSupabaseConfigured() || !env.serviceRole) {
    return {
      ok: false,
      message:
        "Registration requires Supabase URL, anon key and service role key. Configure .env.local and run the migrations first.",
    };
  }

  const admin = createAdminClient();
  let authUserId: string | null = null;

  try {
    const { data: existingEmail } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", parsed.data.email)
      .maybeSingle();
    if (existingEmail) {
      return { ok: false, message: "An account with this email already exists." };
    }

    const baseSlug = slugify(parsed.data.institutionName) || "institution";
    let slug = baseSlug;
    for (let attempt = 1; attempt < 20; attempt += 1) {
      const { data: existingSlug } = await admin
        .from("institutions")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existingSlug) break;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.adminName },
    });

    if (authError || !authUser.user) {
      return {
        ok: false,
        message:
          authError?.message.includes("already")
            ? "An account with this email already exists."
            : authError?.message ?? "Could not create the administrator account.",
      };
    }
    authUserId = authUser.user.id;

    const { data: institution, error: institutionError } = await admin
      .from("institutions")
      .insert({
        name: parsed.data.institutionName,
        slug,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        status: "active",
      })
      .select("id")
      .single();

    if (institutionError || !institution) {
      throw new Error(institutionError?.message ?? "Could not create institution");
    }

    const trialDays = 14;
    const trialEnds = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    const [{ error: settingsError }, { error: profileError }, { error: roleError }] =
      await Promise.all([
        admin.from("institution_settings").insert({
          institution_id: institution.id,
          attendance_threshold: 75,
        }),
        admin.from("profiles").upsert({
          id: authUserId,
          institution_id: institution.id,
          full_name: parsed.data.adminName,
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
        }),
        admin.from("user_roles").insert({
          user_id: authUserId,
          institution_id: institution.id,
          role: "institution_admin",
        }),
      ]);

    if (settingsError || profileError || roleError) {
      throw new Error(
        settingsError?.message ?? profileError?.message ?? roleError?.message
      );
    }

    let planQuery = admin
      .from("subscription_plans")
      .select("id, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1);

    if (parsed.data.plan) {
      planQuery = admin
        .from("subscription_plans")
        .select("id, slug")
        .eq("is_active", true)
        .eq("slug", parsed.data.plan)
        .limit(1);
    }

    const { data: plans } = await planQuery;
    const plan = plans?.[0];

    if (plan) {
      await admin.from("subscriptions").insert({
        institution_id: institution.id,
        plan_id: plan.id,
        status: "trialing",
        starts_at: new Date().toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        ends_at: trialEnds.toISOString(),
      });
    }

    await admin.from("audit_logs").insert({
      institution_id: institution.id,
      actor_id: authUserId,
      actor_email: parsed.data.email,
      action: "institution_registered",
      entity_type: "institution",
      entity_id: institution.id,
      metadata: { plan: plan?.slug ?? null, trial_days: trialDays },
    });

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (signInError) {
      return {
        ok: true,
        redirect: "/login",
        message:
          "Institution created. Please sign in with the credentials you just set.",
      };
    }

    return { ok: true, redirect: "/admin" };
  } catch (error) {
    if (authUserId) {
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch {
        // Best-effort cleanup; the orphaned auth user has no role.
      }
    }
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again.",
    };
  }
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Enter your email address." };
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.appUrl}/auth/callback?next=/reset-password`,
  });

  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message:
      "If an account exists for that address, a password reset link is on its way.",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    redirect: "/auth/redirect",
    message: "Password updated.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true, redirect: "/login" };
}
