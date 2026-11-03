import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { GatewayName } from "@/lib/payments/types";

export interface WebhookRecord {
  id: string | null;
  isNew: boolean;
  processed: boolean;
}

export async function recordWebhookEvent(
  gateway: GatewayName,
  eventId: string | null,
  eventType: string | null,
  payload: unknown
): Promise<WebhookRecord> {
  const admin = createAdminClient();

  if (eventId) {
    const { data: existing } = await admin
      .from("payment_webhook_events")
      .select("id, processed_at")
      .eq("gateway", gateway)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id,
        isNew: false,
        processed: Boolean(existing.processed_at),
      };
    }
  }

  const { data, error } = await admin
    .from("payment_webhook_events")
    .insert({
      gateway,
      event_id: eventId,
      event_type: eventType,
      payload,
      signature_valid: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && eventId) {
      const { data: existing } = await admin
        .from("payment_webhook_events")
        .select("id, processed_at")
        .eq("gateway", gateway)
        .eq("event_id", eventId)
        .maybeSingle();
      return { id: existing?.id ?? null, isNew: false, processed: Boolean(existing?.processed_at) };
    }
    throw new Error(error.message);
  }

  return { id: data.id, isNew: true, processed: false };
}

export async function markWebhookProcessed(id: string | null, processingError: string | null) {
  if (!id) return;
  const admin = createAdminClient();
  await admin
    .from("payment_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    })
    .eq("id", id);
}
