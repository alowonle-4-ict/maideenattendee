import { NextResponse, type NextRequest } from "next/server";

import {
  settlePayment,
  verifyGatewayPayment,
} from "@/lib/payments";
import { PaymentGatewayError, type GatewayName } from "@/lib/payments/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backToBilling(
  request: NextRequest,
  params: Record<string, string>
) {
  const url = new URL("/admin/billing", request.nextUrl.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const txRef = search.get("tx_ref");
  const reference =
    search.get("reference") ?? search.get("trxref") ?? txRef ?? "";

  if (!reference) {
    return backToBilling(request, {
      payment: "unknown",
      reason: "The payment gateway did not return a reference.",
    });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return backToBilling(request, {
      payment: "error",
      reason: "Supabase service role is not configured, so payments cannot be verified.",
    });
  }

  const { data: payment } = await admin
    .from("payments")
    .select("id, gateway, reference, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!payment) {
    return backToBilling(request, {
      payment: "unknown",
      reference,
      reason: "No payment record matches this reference.",
    });
  }

  const gateway = payment.gateway as GatewayName;

  if (payment.status === "success") {
    return backToBilling(request, { payment: "success", reference });
  }

  try {
    const verified = await verifyGatewayPayment(gateway, reference);
    const result = await settlePayment(verified);

    return backToBilling(request, {
      payment: result.ok ? "success" : "pending",
      reference,
      ...(result.message ? { reason: result.message } : {}),
    });
  } catch (error) {
    return backToBilling(request, {
      payment: "error",
      reference,
      reason:
        error instanceof PaymentGatewayError
          ? error.message
          : "Could not verify this payment with the gateway. Check the billing history shortly.",
    });
  }
}
