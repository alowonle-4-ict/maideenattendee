import { NextResponse, type NextRequest } from "next/server";

import { settlePayment } from "@/lib/payments";
import {
  isFlutterwaveSignatureValid,
  verifyFlutterwavePayment,
} from "@/lib/payments/flutterwave";
import { markWebhookProcessed, recordWebhookEvent } from "@/lib/payments/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FlutterwavePayload {
  event?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("verif-hash");
  if (!(await isFlutterwaveSignatureValid(signature))) {
    return NextResponse.json({ status: "error", message: "Invalid signature" }, { status: 401 });
  }

  const rawBody = await request.text();

  let payload: FlutterwavePayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON" }, { status: 400 });
  }

  try {
    const transactionId = payload.data?.id;
    const eventId =
      transactionId != null ? `${payload.event ?? "event"}:${transactionId}` : null;

    const record = await recordWebhookEvent(
      "flutterwave",
      eventId,
      payload.event ?? null,
      payload
    );

    if (!record.isNew || record.processed) {
      return NextResponse.json({ status: "ok", duplicate: true });
    }

    let processingError: string | null = null;

    const isCharge = (payload.event ?? "").startsWith("charge");
    if (isCharge && transactionId != null) {
      // Re-verify with the Flutterwave API using the transaction id; the
      // webhook body itself is never trusted for amounts or status.
      const verified = await verifyFlutterwavePayment(String(transactionId));
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
