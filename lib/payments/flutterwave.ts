import "server-only";

import { timingSafeEqual } from "crypto";

import { env } from "@/lib/env";
import {
  PaymentGatewayError,
  type GatewayPaymentState,
  type InitializePaymentInput,
  type InitializePaymentResult,
  type VerifiedPayment,
} from "@/lib/payments/types";

const BASE_URL = "https://api.flutterwave.com/v3";

interface FlutterwaveResponse<T> {
  status: string;
  message: string;
  data: T;
}

async function flutterwaveRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.flutterwaveSecret) {
    throw new PaymentGatewayError(
      "Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY on the server.",
      "flutterwave"
    );
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.flutterwaveSecret}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new PaymentGatewayError(
      "Could not reach Flutterwave. Check the server's internet connection and try again.",
      "flutterwave"
    );
  }

  const payload = (await response.json().catch(() => null)) as FlutterwaveResponse<T> | null;

  if (!response.ok || payload?.status !== "success") {
    throw new PaymentGatewayError(
      payload?.message ?? `Flutterwave request failed with status ${response.status}.`,
      "flutterwave",
      response.status
    );
  }

  return payload.data;
}

function mapState(status?: string): GatewayPaymentState {
  switch ((status ?? "").toLowerCase()) {
    case "successful":
    case "success":
      return "success";
    case "failed":
      return "failed";
    case "cancelled":
    case "abandoned":
      return "abandoned";
    case "pending":
    case "processing":
      return "pending";
    default:
      return "unknown";
  }
}

export function isFlutterwaveSignatureValid(signature: string | null) {
  if (!env.flutterwaveHash || !signature) return false;
  const expected = Buffer.from(env.flutterwaveHash);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export async function initializeFlutterwavePayment(
  input: InitializePaymentInput
): Promise<InitializePaymentResult> {
  const data = await flutterwaveRequest<{ link: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: input.reference,
      amount: Number(input.amountNgn.toFixed(2)),
      currency: "NGN",
      redirect_url: input.callbackUrl,
      customer: {
        email: input.email,
        name: input.customerName ?? input.email.split("@")[0],
      },
      customizations: {
        title: "MaideenAttendee subscription",
        description: input.planName,
      },
      meta: {
        plan_name: input.planName,
        ...(input.metadata ?? {}),
      },
    }),
  });

  return { authorizationUrl: data.link, gatewayReference: null };
}

export async function verifyFlutterwavePayment(referenceOrId: string): Promise<VerifiedPayment> {
  const data = await flutterwaveRequest<{
    status: string;
    tx_ref: string;
    amount: number;
    currency: string;
    id: number;
    created_at: string | null;
    payment_type: string | null;
    processor_response: string | null;
  }>(`/transactions/${encodeURIComponent(referenceOrId)}/verify`);

  return {
    gateway: "flutterwave",
    reference: data.tx_ref,
    gatewayReference: data.id ? String(data.id) : null,
    amountNgn: Number(data.amount ?? 0),
    currency: (data.currency ?? "NGN").toUpperCase(),
    state: mapState(data.status),
    channel: data.payment_type ?? null,
    paidAt: data.created_at ?? null,
    failureReason: mapState(data.status) === "success" ? null : data.processor_response ?? null,
    raw: data,
  };
}
