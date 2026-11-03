"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { requireAuth, requireInstitution } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  getGatewayAvailability,
  initializeGatewayPayment,
  settlePayment,
  verifyGatewayPayment,
} from "@/lib/payments";
import { PaymentGatewayError, type GatewayName } from "@/lib/payments/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import type { ActionState } from "@/lib/actions/admin";

export interface CheckoutResult {
  ok: boolean;
  message?: string;
  url?: string;
}

const GATEWAYS: GatewayName[] = ["paystack", "flutterwave"];

function paymentReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `MAI-${stamp}-${suffix}`;
}

function revalidateBilling() {
  revalidatePath("/admin/billing");
  revalidatePath("/admin/subscription");
  revalidatePath("/platform/payments");
  revalidatePath("/platform/subscriptions");
  revalidatePath("/platform/revenue");
  revalidatePath("/platform");
}

export async function startCheckout(
  planId: string,
  gateway: GatewayName
): Promise<CheckoutResult> {
  const ctx = await requireInstitution();

  if (!isUuid(planId)) return { ok: false, message: "Choose a valid subscription plan." };
  if (!GATEWAYS.includes(gateway)) return { ok: false, message: "Unsupported payment gateway." };

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id, name, slug, price_ngn, duration_days, is_active")
    .eq("id", planId)
    .maybeSingle();

  if (!plan || !plan.is_active) {
    return { ok: false, message: "This plan is no longer available. Refresh the page and try again." };
  }

  const price = Number(plan.price_ngn);
  if (price <= 0) {
    return {
      ok: false,
      message: "This plan does not require payment. Contact the platform administrator to activate it.",
    };
  }

  const availability = (await getGatewayAvailability()).find((item) => item.gateway === gateway);
  if (!availability) return { ok: false, message: "Unsupported payment gateway." };
  if (!availability.enabled) {
    return { ok: false, message: `${availability.label} payments are disabled by the platform administrator.` };
  }
  if (!availability.configured) {
    return {
      ok: false,
      message: `${availability.label} is not configured on this deployment. Missing server variables: ${availability.missing.join(", ")}.`,
    };
  }

  const email = ctx.profile?.email ?? ctx.user.email;
  if (!email) {
    return { ok: false, message: "Your account has no email address. Contact the platform administrator." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Server credentials are not configured.",
    };
  }

  const reference = paymentReference();
  const { data: payment, error: insertError } = await admin
    .from("payments")
    .insert({
      institution_id: ctx.institutionId,
      plan_id: plan.id,
      amount: price,
      currency: "NGN",
      gateway,
      reference,
      status: "pending",
      customer_email: email,
      metadata: {
        plan_slug: plan.slug,
        plan_name: plan.name,
        initiated_by: ctx.user.id,
      },
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return { ok: false, message: insertError?.message ?? "Could not create the payment record." };
  }

  try {
    const initialized = await initializeGatewayPayment(gateway, {
      reference,
      amountNgn: price,
      email,
      customerName: ctx.profile?.full_name,
      planName: `${plan.name} plan`,
      callbackUrl: `${env.appUrl}/api/payments/callback`,
      metadata: {
        payment_id: payment.id,
        institution_id: ctx.institutionId,
        plan_id: plan.id,
        plan_slug: plan.slug,
      },
    });

    await admin
      .from("payments")
      .update({
        authorization_url: initialized.authorizationUrl,
        gateway_reference: initialized.gatewayReference,
      })
      .eq("id", payment.id);

    return { ok: true, url: initialized.authorizationUrl };
  } catch (error) {
    const message =
      error instanceof PaymentGatewayError
        ? error.message
        : "Could not reach the payment gateway. Please try again.";

    await admin
      .from("payments")
      .update({ status: "failed", failure_reason: message })
      .eq("id", payment.id);

    return { ok: false, message };
  }
}

export async function verifyPayment(reference: string): Promise<ActionState> {
  const ctx = await requireAuth(["institution_admin", "super_admin"]);
  if (!reference.trim()) return { ok: false, message: "Payment reference is required." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Server credentials are not configured.",
    };
  }

  const { data: payment } = await admin
    .from("payments")
    .select("id, gateway, institution_id, status, reference")
    .eq("reference", reference.trim())
    .maybeSingle();

  if (!payment) return { ok: false, message: "Payment record not found." };
  if (ctx.role === "institution_admin" && payment.institution_id !== ctx.institutionId) {
    return { ok: false, message: "You do not have access to this payment." };
  }
  if (payment.status === "success") {
    return { ok: true, message: "This payment is already confirmed." };
  }

  try {
    const verified = await verifyGatewayPayment(payment.gateway as GatewayName, payment.reference);
    const result = await settlePayment(verified);
    revalidateBilling();
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof PaymentGatewayError
          ? error.message
          : "Could not verify the payment with the gateway. Try again shortly.",
    };
  }
}

export async function cancelSubscriptionRenewal(): Promise<ActionState> {
  const { institutionId } = await requireInstitution();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("institution_id", institutionId)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  if (!subscription) return { ok: false, message: "No active subscription found." };
  if (subscription.status === "trialing") {
    return { ok: false, message: "This subscription is still in its trial period." };
  }

  const { error } = await admin
    .from("subscriptions")
    .update({ auto_renew: false, cancelled_at: new Date().toISOString() })
    .eq("id", subscription.id)
    .eq("institution_id", institutionId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/subscription");
  return {
    ok: true,
    message: "Automatic renewal cancelled. Your plan stays active until the end of the current period.",
  };
}
