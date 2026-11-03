import { NextResponse, type NextRequest } from "next/server";

import { settlePayment } from "@/lib/payments";
import { isPaystackSignatureValid, verifyPaystackPayment } from "@/lib/payments/paystack";
import { markWebhookProcessed, recordWebhookEvent } from "@/lib/payments/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!isPaystackSignatureValid(rawBody, signature)) {
    return NextResponse.json({ status: "error", message: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: { id?: number | string; reference?: string };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON" }, { status: 400 });
  }

  try {
    const eventId = payload.data?.id != null ? `paystack:${payload.data.id}` : null;
    const record = await recordWebhookEvent(
      "paystack",
      eventId,
      payload.event ?? null,
      payload
    );

    if (!record.isNew || record.processed) {
      return NextResponse.json({ status: "ok", duplicate: true });
    }

    let processingError: string | null = null;

    if (payload.event === "charge.success" && payload.data?.reference) {
      // The webhook payload drives notification only; the transaction is
      // re-verified against the Paystack API before any subscription changes.
      const verified = await verifyPaystackPayment(payload.data.reference);
      const result = await settlePayment(verified);
      if (!result.ok && !result.alreadyProcessed) {
        processingError = result.message;
      }
    }

    await markWebhookProcessed(record.id, processingError);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
