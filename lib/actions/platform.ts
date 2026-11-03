"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/actions/admin";
import type { GatewayName } from "@/lib/payments/types";

const INSTITUTION_STATUSES = ["pending", "active", "suspended", "deleted"] as const;
const SUBSCRIPTION_STATUSES = ["active", "past_due", "expired", "cancelled"] as const;
const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

async function requirePlatform() {
  return requireAuth(["super_admin"]);
}

async function audit(
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {}
) {
  try {
    const ctx = await requirePlatform();
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      institution_id: null,
      actor_id: ctx.user.id,
      actor_email: ctx.profile?.email ?? ctx.user.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch {
    // Auditing must never block the primary operation.
  }
}

function revalidatePlatform() {
  revalidatePath("/platform");
  revalidatePath("/platform/institutions");
  revalidatePath("/platform/users");
  revalidatePath("/platform/subscriptions");
  revalidatePath("/platform/plans");
}

export async function setInstitutionStatus(
  institutionId: string,
  status: (typeof INSTITUTION_STATUSES)[number]
): Promise<ActionState> {
  await requirePlatform();
  if (!INSTITUTION_STATUSES.includes(status)) {
    return { ok: false, message: "Unsupported institution status." };
  }

  const admin = createAdminClient();
  const { data: institution } = await admin
    .from("institutions")
    .select("id, name, status")
    .eq("id", institutionId)
    .maybeSingle();
  if (!institution) return { ok: false, message: "Institution not found." };

  const { error } = await admin
    .from("institutions")
    .update({ status })
    .eq("id", institutionId);
  if (error) return { ok: false, message: error.message };

  await audit("institution_status_changed", "institution", institutionId, {
    from: institution.status,
    to: status,
  });

  revalidatePlatform();
  revalidatePath(`/platform/institutions/${institutionId}`);

  return {
    ok: true,
    message:
      status === "active"
        ? `${institution.name} is now active.`
        : status === "suspended"
          ? `${institution.name} has been suspended.`
          : status === "deleted"
            ? `${institution.name} has been marked deleted.`
            : `${institution.name} is now pending.`,
  };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionState> {
  await requirePlatform();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, message: "User not found." };

  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId);
  if (error) return { ok: false, message: error.message };

  await audit(active ? "user_activated" : "user_deactivated", "profile", userId);
  revalidatePath("/platform/users");
  return {
    ok: true,
    message: `${profile.full_name} has been ${active ? "activated" : "deactivated"}.`,
  };
}

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter the plan name").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Enter a slug")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only"),
  description: z.string().trim().max(600).optional(),
  price_ngn: z.coerce.number().min(0, "Price cannot be negative"),
  billing_cycle: z.enum(["monthly", "semester", "annual", "custom"]),
  duration_days: z.coerce.number().int().min(1, "At least 1 day").max(3650),
  max_students: z.coerce.number().int().min(1).max(1_000_000),
  max_lecturers: z.coerce.number().int().min(1).max(100_000),
  max_courses: z.coerce.number().int().min(1).max(100_000),
  features: z.string().optional(),
  is_active: z.string().optional(),
  sort_order: z.coerce.number().int().min(0).max(10_000).optional(),
});

export async function savePlan(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatform();

  const parsed = planSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: String(formData.get("description") ?? "") || undefined,
    price_ngn: formData.get("price_ngn"),
    billing_cycle: formData.get("billing_cycle"),
    duration_days: formData.get("duration_days"),
    max_students: formData.get("max_students"),
    max_lecturers: formData.get("max_lecturers"),
    max_courses: formData.get("max_courses"),
    features: String(formData.get("features") ?? ""),
    is_active: String(formData.get("is_active") ?? "on"),
    sort_order: formData.get("sort_order") ?? 0,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const key = issue.path[0];
      if (key && !fieldErrors[String(key)]) fieldErrors[String(key)] = issue.message;
    });
    return { ok: false, message: "Check the plan details.", fieldErrors };
  }

  const features = (parsed.data.features ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? null,
    price_ngn: parsed.data.price_ngn,
    billing_cycle: parsed.data.billing_cycle,
    duration_days: parsed.data.duration_days,
    max_students: parsed.data.max_students,
    max_lecturers: parsed.data.max_lecturers,
    max_courses: parsed.data.max_courses,
    features,
    is_active: parsed.data.is_active !== "off",
    sort_order: parsed.data.sort_order ?? 0,
  };

  const admin = createAdminClient();

  if (parsed.data.id) {
    const { error } = await admin
      .from("subscription_plans")
      .update(payload)
      .eq("id", parsed.data.id);
    if (error) {
      return {
        ok: false,
        message:
          error.code === "23505"
            ? "Another plan already uses this slug."
            : error.message,
      };
    }
    await audit("subscription_plan_updated", "subscription_plan", parsed.data.id, {
      slug: payload.slug,
    });
    revalidatePath("/platform/plans");
    revalidatePath("/pricing");
    return { ok: true, message: "Plan updated." };
  }

  const { data: created, error } = await admin
    .from("subscription_plans")
    .insert(payload)
    .select("id")
    .single();

  if (error || !created) {
    return {
      ok: false,
      message:
        error?.code === "23505"
          ? "Another plan already uses this slug."
          : error?.message ?? "Could not create the plan.",
    };
  }

  await audit("subscription_plan_created", "subscription_plan", created.id, {
    slug: payload.slug,
  });
  revalidatePath("/platform/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Plan created." };
}

export async function togglePlanActive(planId: string): Promise<ActionState> {
  await requirePlatform();
  const admin = createAdminClient();

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("id, name, is_active")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, message: "Plan not found." };

  const next = !plan.is_active;
  const { error } = await admin
    .from("subscription_plans")
    .update({ is_active: next })
    .eq("id", planId);
  if (error) return { ok: false, message: error.message };

  await audit("subscription_plan_toggled", "subscription_plan", planId, {
    is_active: next,
  });
  revalidatePath("/platform/plans");
  revalidatePath("/pricing");
  return {
    ok: true,
    message: `${plan.name} is now ${next ? "available" : "hidden"} to institutions.`,
  };
}

export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: (typeof SUBSCRIPTION_STATUSES)[number]
): Promise<ActionState> {
  await requirePlatform();
  if (!SUBSCRIPTION_STATUSES.includes(status)) {
    return { ok: false, message: "Unsupported subscription status." };
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, institution_id, status, ends_at")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!subscription) return { ok: false, message: "Subscription not found." };

  if (status === "active" || status === "past_due") {
    const { data: conflict } = await admin
      .from("subscriptions")
      .select("id")
      .eq("institution_id", subscription.institution_id)
      .in("status", ["trialing", "active", "past_due"])
      .neq("id", subscriptionId)
      .maybeSingle();
    if (conflict) {
      return {
        ok: false,
        message:
          "This institution already has another live subscription. Expire or cancel it first.",
      };
    }
  }

  const update: Record<string, unknown> = { status };
  if (status === "cancelled") update.cancelled_at = new Date().toISOString();
  if (status === "expired") update.ends_at = new Date().toISOString();

  const { error } = await admin
    .from("subscriptions")
    .update(update)
    .eq("id", subscriptionId);
  if (error) return { ok: false, message: error.message };

  await audit("subscription_status_changed", "subscription", subscriptionId, {
    from: subscription.status,
    to: status,
  });
  revalidatePath("/platform/subscriptions");
  revalidatePath("/platform");
  return { ok: true, message: `Subscription marked ${status.replace("_", " ")}.` };
}

export async function updateTicketStatus(
  ticketId: string,
  status: (typeof TICKET_STATUSES)[number]
): Promise<ActionState> {
  await requirePlatform();
  if (!TICKET_STATUSES.includes(status)) {
    return { ok: false, message: "Unsupported ticket status." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("support_tickets")
    .update({ status })
    .eq("id", ticketId);
  if (error) return { ok: false, message: error.message };

  await audit("support_ticket_status_changed", "support_ticket", ticketId, { status });
  revalidatePath("/platform/support");
  return { ok: true, message: `Ticket marked ${status.replace("_", " ")}.` };
}

export async function setGatewayEnabled(
  gateway: GatewayName,
  enabled: boolean
): Promise<ActionState> {
  await requirePlatform();
  if (gateway !== "paystack" && gateway !== "flutterwave") {
    return { ok: false, message: "Unsupported payment gateway." };
  }

  const admin = createAdminClient();
  const { data: current } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "payment_gateways")
    .maybeSingle();

  const value = {
    paystack: true,
    flutterwave: true,
    ...((current?.value ?? {}) as Record<string, unknown>),
    [gateway]: enabled,
  };

  const { error } = await admin
    .from("platform_settings")
    .upsert({ key: "payment_gateways", value });
  if (error) return { ok: false, message: error.message };

  await audit("payment_gateway_toggled", "platform_setting", "payment_gateways", {
    gateway,
    enabled,
  });
  revalidatePath("/platform/gateways");
  revalidatePath("/admin/subscription");
  revalidatePath("/admin/billing");
  return {
    ok: true,
    message: `${gateway === "paystack" ? "Paystack" : "Flutterwave"} ${enabled ? "enabled" : "disabled"}.`,
  };
}

const settingsSchema = z.object({
  trial_days: z.coerce.number().int().min(1, "At least 1 day").max(365),
  support_email: z.string().trim().email("Enter a valid support email"),
  paystack: z.string().optional(),
  flutterwave: z.string().optional(),
});

export async function updatePlatformSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePlatform();
  const parsed = settingsSchema.safeParse({
    trial_days: formData.get("trial_days"),
    support_email: formData.get("support_email"),
    paystack: formData.get("paystack") ?? "off",
    flutterwave: formData.get("flutterwave") ?? "off",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const key = issue.path[0];
      if (key && !fieldErrors[String(key)]) fieldErrors[String(key)] = issue.message;
    });
    return { ok: false, message: "Check the settings.", fieldErrors };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert([
    { key: "trial_days", value: { value: parsed.data.trial_days } },
    { key: "support_email", value: { value: parsed.data.support_email } },
    {
      key: "payment_gateways",
      value: {
        paystack: parsed.data.paystack === "on",
        flutterwave: parsed.data.flutterwave === "on",
      },
    },
  ]);

  if (error) return { ok: false, message: error.message };

  await audit("platform_settings_updated", "platform_setting", null);
  revalidatePath("/platform/settings");
  revalidatePath("/platform/gateways");
  revalidatePath("/admin/subscription");
  return { ok: true, message: "Platform settings saved." };
}
