import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { resolveGatewaySecrets } from "@/lib/secrets/gateways";
import {
  PaymentGatewayError,
  type GatewayPaymentState,
  type InitializePaymentInput,
  type InitializePaymentResult,
  type VerifiedPayment,
} from "@/lib/payments/types";

const BASE_URL = "https://api.paystack.co";

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

async function paystackSecretKey(): Promise<string> {
  const { paystack } = await resolveGatewaySecrets();
  if (!paystack.secretKey) {
    throw new PaymentGatewayError(
      "Paystack is not configured. Add the secret key under Platform \u2192 Payment gateways, or set PAYSTACK_SECRET_KEY on the server.",
      "paystack"
    );
  }
  return paystack.secretKey;
}

async function paystackRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const secretKey = await paystackSecretKey();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new PaymentGatewayError(
      "Could not reach Paystack. Check the server's internet connection and try again.",
      "paystack"
    );
  }

  const payload = (await response.json().catch(() => null)) as PaystackResponse<T> | null;

  if (!response.ok || !payload?.status) {
    throw new PaymentGatewayError(
      payload?.message ?? `Paystack request failed with status ${response.status}.`,
      "paystack",
      response.status
    );
  }

  return payload.data;
}

function mapState(status?: string): GatewayPaymentState {
  switch (status) {
    case "success":
      return "success";
    case "abandoned":
      return "abandoned";
    case "failed":
    case "reversed":
      return "failed";
    case "ongoing":
    case "pending":
    case "processing":
    case "queued":
      return "pending";
    default:
      return "unknown";
  }
}

export async function isPaystackSignatureValid(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const secretKey = await paystackSecretKey().catch(() => null);
  if (!secretKey) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const received = signature.trim().toLowerCase();
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export async function initializePaystackPayment(
  input: InitializePaymentInput
): Promise<InitializePaymentResult> {
  const data = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountNgn * 100),
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: {
        plan_name: input.planName,
        customer_name: input.customerName ?? null,
        ...(input.metadata ?? {}),
      },
    }),
  });

  return {
    authorizationUrl: data.authorization_url,
    gatewayReference: data.reference ?? null,
  };
}

export async function verifyPaystackPayment(reference: string): Promise<VerifiedPayment> {
  const data = await paystackRequest<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    channel: string | null;
    id: number;
    gateway_response: string | null;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);

  return {
    gateway: "paystack",
    reference: data.reference,
    gatewayReference: data.id ? String(data.id) : null,
    amountNgn: Number(data.amount ?? 0) / 100,
    currency: (data.currency ?? "NGN").toUpperCase(),
    state: mapState(data.status),
    channel: data.channel ?? null,
    paidAt: data.paid_at ?? null,
    failureReason: data.status === "success" ? null : data.gateway_response ?? null,
    raw: data,
  };
}
