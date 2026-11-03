import "server-only";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
} from "@/lib/payments/flutterwave";
import {
  initializePaystackPayment,
  verifyPaystackPayment,
} from "@/lib/payments/paystack";
import {
  PaymentGatewayError,
  type GatewayAvailability,
  type GatewayName,
  type InitializePaymentInput,
  type InitializePaymentResult,
  type VerifiedPayment,
} from "@/lib/payments/types";

export interface GatewayFlags {
  paystack: boolean;
  flutterwave: boolean;
}

export async function getGatewayFlags(): Promise<GatewayFlags> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "payment_gateways")
      .maybeSingle();
    const value = (data?.value ?? {}) as Partial<GatewayFlags>;
    return {
      paystack: value.paystack !== false,
      flutterwave: value.flutterwave !== false,
    };
  } catch {
    return { paystack: true, flutterwave: true };
  }
}

export function gatewayConfigIssues(gateway: GatewayName): string[] {
  if (gateway === "paystack") {
    return env.paystackSecret ? [] : ["PAYSTACK_SECRET_KEY"];
  }
  const missing: string[] = [];
  if (!env.flutterwaveSecret) missing.push("FLUTTERWAVE_SECRET_KEY");
  if (!env.flutterwaveHash) missing.push("FLUTTERWAVE_SECRET_HASH");
  return missing;
}

export async function getGatewayAvailability(): Promise<GatewayAvailability[]> {
  const flags = await getGatewayFlags();
  return (["paystack", "flutterwave"] as GatewayName[]).map((gateway) => {
    const missing = gatewayConfigIssues(gateway);
    return {
      gateway,
      label: gateway === "paystack" ? "Paystack" : "Flutterwave",
      configured: missing.length === 0,
      enabled: flags[gateway],
      missing,
    };
  });
}

export async function assertGatewayAvailable(gateway: GatewayName) {
  const flags = await getGatewayFlags();
  if (!flags[gateway]) {
    throw new PaymentGatewayError(
      `${gateway === "paystack" ? "Paystack" : "Flutterwave"} payments are disabled by the platform administrator.`,
      gateway
    );
  }
  const missing = gatewayConfigIssues(gateway);
  if (missing.length > 0) {
    throw new PaymentGatewayError(
      `${gateway === "paystack" ? "Paystack" : "Flutterwave"} is not configured. Missing server variables: ${missing.join(", ")}.`,
      gateway
    );
  }
}

export async function initializeGatewayPayment(
  gateway: GatewayName,
  input: InitializePaymentInput
): Promise<InitializePaymentResult> {
  await assertGatewayAvailable(gateway);
  return gateway === "paystack"
    ? initializePaystackPayment(input)
    : initializeFlutterwavePayment(input);
}

export async function verifyGatewayPayment(
  gateway: GatewayName,
  reference: string
): Promise<VerifiedPayment> {
  return gateway === "paystack"
    ? verifyPaystackPayment(reference)
    : verifyFlutterwavePayment(reference);
}

export interface SettlementResult {
  ok: boolean;
  message: string;
  alreadyProcessed?: boolean;
  subscriptionId?: string;
}

/**
 * Activates or extends the institution subscription from a gateway-verified
 * payment. Safe to call from both the redirect callback and webhooks — repeated
 * calls for an already successful payment are no-ops.
 */
export async function settlePayment(verified: VerifiedPayment): Promise<SettlementResult> {
  const admin = createAdminClient();

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select(
      "id, institution_id, subscription_id, plan_id, amount, currency, status, reference, metadata"
    )
    .eq("gateway", verified.gateway)
    .eq("reference", verified.reference)
    .maybeSingle();

  if (paymentError) {
    return { ok: false, message: paymentError.message };
  }
  if (!payment) {
    return { ok: false, message: `No payment record found for reference ${verified.reference}.` };
  }

  if (payment.status === "success") {
    return {
      ok: true,
      message: "This payment was already confirmed.",
      alreadyProcessed: true,
      subscriptionId: payment.subscription_id ?? undefined,
    };
  }

  if (verified.state !== "success") {
    const failureStatus =
      verified.state === "abandoned" ? "abandoned" : verified.state === "pending" ? "pending" : "failed";
    await admin
      .from("payments")
      .update({
        status: failureStatus,
        gateway_reference: verified.gatewayReference,
        failure_reason: verified.failureReason ?? "The gateway did not confirm this payment.",
        channel: verified.channel,
      })
      .eq("id", payment.id);

    return {
      ok: false,
      message:
        failureStatus === "pending"
          ? "The gateway has not confirmed this payment yet. It will update automatically once confirmed."
          : verified.failureReason ?? "The payment was not successful.",
    };
  }

  if (verified.currency !== "NGN") {
    await admin
      .from("payments")
      .update({
        status: "failed",
        gateway_reference: verified.gatewayReference,
        failure_reason: `Unexpected currency ${verified.currency}.`,
      })
      .eq("id", payment.id);
    return { ok: false, message: "The gateway reported an unexpected currency. No subscription was changed." };
  }

  const expected = Number(payment.amount);
  if (Math.abs(expected - verified.amountNgn) > 0.01) {
    await admin
      .from("payments")
      .update({
        status: "failed",
        gateway_reference: verified.gatewayReference,
        failure_reason: `Amount mismatch: expected ${expected.toFixed(2)} NGN, gateway reported ${verified.amountNgn.toFixed(2)} NGN.`,
      })
      .eq("id", payment.id);
    return {
      ok: false,
      message: "The verified amount does not match the invoice. No subscription was changed.",
    };
  }

  if (!payment.plan_id) {
    return { ok: false, message: "This payment has no subscription plan attached." };
  }

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("id, name, duration_days")
    .eq("id", payment.plan_id)
    .maybeSingle();

  if (!plan) {
    return { ok: false, message: "The subscription plan for this payment no longer exists." };
  }

  const now = new Date();
  const { data: live } = await admin
    .from("subscriptions")
    .select("id, status, ends_at")
    .eq("institution_id", payment.institution_id)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  const base =
    live?.ends_at && new Date(live.ends_at).getTime() > now.getTime()
      ? new Date(live.ends_at)
      : now;
  const endsAt = new Date(base.getTime() + Number(plan.duration_days) * 86_400_000);

  let subscriptionId = live?.id ?? null;

  if (subscriptionId) {
    const update: Record<string, unknown> = {
      plan_id: plan.id,
      status: "active",
      ends_at: endsAt.toISOString(),
      trial_ends_at: null,
      cancelled_at: null,
    };
    if (live?.status !== "active") update.starts_at = now.toISOString();

    const { error } = await admin
      .from("subscriptions")
      .update(update)
      .eq("id", subscriptionId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { data: created, error } = await admin
      .from("subscriptions")
      .insert({
        institution_id: payment.institution_id,
        plan_id: plan.id,
        status: "active",
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, message: error?.message ?? "Could not activate the subscription." };
    }
    subscriptionId = created.id;
  }

  const metadata = {
    ...((payment.metadata ?? {}) as Record<string, unknown>),
    verified_amount: verified.amountNgn,
    verified_currency: verified.currency,
    settled_at: now.toISOString(),
    gateway_channel: verified.channel,
  };

  const { error: updateError } = await admin
    .from("payments")
    .update({
      status: "success",
      gateway_reference: verified.gatewayReference,
      paid_at: verified.paidAt ?? now.toISOString(),
      channel: verified.channel,
      failure_reason: null,
      subscription_id: subscriptionId,
      metadata,
    })
    .eq("id", payment.id);

  if (updateError) return { ok: false, message: updateError.message };

  await admin.from("audit_logs").insert({
    institution_id: payment.institution_id,
    actor_email: `gateway:${verified.gateway}`,
    action: "subscription_payment_confirmed",
    entity_type: "payment",
    entity_id: payment.id,
    metadata: {
      reference: verified.reference,
      plan: plan.name,
      amount: verified.amountNgn,
      gateway: verified.gateway,
      subscription_id: subscriptionId,
    },
  });

  try {
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("institution_id", payment.institution_id)
      .eq("role", "institution_admin");

    if (admins && admins.length > 0) {
      await admin.from("notifications").insert(
        admins.map((row) => ({
          institution_id: payment.institution_id,
          user_id: row.user_id,
          title: "Subscription activated",
          body: `Your ${plan.name} plan is active until ${endsAt.toLocaleDateString("en-NG", {
            dateStyle: "medium",
          })}. Payment reference ${verified.reference}.`,
          type: "billing",
          link: "/admin/subscription",
        }))
      );
    }
  } catch {
    // Notifications are best-effort; the payment is already settled.
  }

  return {
    ok: true,
    message: `Payment confirmed. Your ${plan.name} plan is active.`,
    subscriptionId: subscriptionId ?? undefined,
  };
}
