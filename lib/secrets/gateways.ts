import "server-only";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
  secretsEncryptionConfigured,
} from "@/lib/secrets/crypto";
import type { GatewayName } from "@/lib/payments/types";

export const GATEWAY_CREDENTIALS_SETTINGS_KEY = "payment_gateway_credentials";

type StoredEntry = Record<string, string>;
type StoredRow = Partial<Record<GatewayName, StoredEntry>>;

export type CredentialSource = "stored" | "environment" | "none";

export interface GatewayCredentialField {
  field: string;
  label: string;
  masked: string;
  source: CredentialSource;
}

export interface GatewayCredentialSummary {
  gateway: GatewayName;
  updatedAt: string | null;
  fields: GatewayCredentialField[];
  secretSource: CredentialSource;
}

export interface ResolvedGatewaySecrets {
  paystack: { secretKey: string; source: CredentialSource };
  flutterwave: { secretKey: string; secretHash: string; source: CredentialSource };
}

const FIELD_LABELS: Record<string, string> = {
  secret_key: "Secret key",
  secret_hash: "Webhook secret hash",
};

async function readStoredRow(): Promise<StoredRow> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", GATEWAY_CREDENTIALS_SETTINGS_KEY)
      .maybeSingle();
    return (data?.value ?? {}) as StoredRow;
  } catch {
    return {};
  }
}

function pick(
  entry: StoredEntry | undefined,
  field: string,
  fallback: string
): { value: string; source: CredentialSource } {
  const stored = decryptSecret(entry?.[field]);
  if (stored) return { value: stored, source: "stored" };
  if (fallback) return { value: fallback, source: "environment" };
  return { value: "", source: "none" };
}

/**
 * Server-side only. Dashboard-managed credentials take precedence over the
 * matching environment variables so a key can be rotated without a redeploy.
 */
export async function resolveGatewaySecrets(): Promise<ResolvedGatewaySecrets> {
  const row = await readStoredRow();
  const paystack = row.paystack;
  const flutterwave = row.flutterwave;

  const paystackSecret = pick(paystack, "secret_key", env.paystackSecret);
  const flutterwaveSecret = pick(flutterwave, "secret_key", env.flutterwaveSecret);
  const flutterwaveHash = pick(flutterwave, "secret_hash", env.flutterwaveHash);

  return {
    paystack: {
      secretKey: paystackSecret.value,
      source: paystackSecret.source,
    },
    flutterwave: {
      secretKey: flutterwaveSecret.value,
      secretHash: flutterwaveHash.value,
      source: flutterwaveSecret.source,
    },
  };
}

/** Masked view for the platform dashboard. Never returns a plaintext secret. */
export async function getGatewayCredentialSummaries(): Promise<GatewayCredentialSummary[]> {
  const row = await readStoredRow();

  const build = (
    gateway: GatewayName,
    entry: StoredEntry | undefined,
    fields: Array<[string, string]>
  ): GatewayCredentialSummary => {
    const summary: GatewayCredentialSummary = {
      gateway,
      updatedAt: entry?.updated_at ?? null,
      fields: fields.map(([field, fallback]) => {
        const resolved = pick(entry, field, fallback);
        return {
          field,
          label: FIELD_LABELS[field] ?? field,
          masked: resolved.value ? maskSecret(resolved.value) : "",
          source: resolved.source,
        };
      }),
      secretSource:
        fields
          .map(([field, fallback]) => pick(entry, field, fallback).source)
          .find((source) => source !== "none") ?? "none",
    };
    return summary;
  };

  return [
    build("paystack", row.paystack, [["secret_key", env.paystackSecret]]),
    build("flutterwave", row.flutterwave, [
      ["secret_key", env.flutterwaveSecret],
      ["secret_hash", env.flutterwaveHash],
    ]),
  ];
}

/**
 * Blank values keep the credential already on file, so the masked preview can be
 * shown in the same form without risking an accidental wipe.
 */
export async function saveGatewayCredentialValues(
  gateway: GatewayName,
  values: Record<string, string>
): Promise<{ ok: boolean; message?: string }> {
  if (!secretsEncryptionConfigured()) {
    return {
      ok: false,
      message:
        "Credential storage is disabled because this server has no encryption key. Set SECRETS_ENCRYPTION_KEY and redeploy.",
    };
  }

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", GATEWAY_CREDENTIALS_SETTINGS_KEY)
    .maybeSingle();

  if (readError) return { ok: false, message: readError.message };

  const row = ((current?.value ?? {}) as StoredRow) ?? {};
  const entry: StoredEntry = { ...(row[gateway] ?? {}) };

  let changed = 0;
  for (const [field, value] of Object.entries(values)) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) continue;
    entry[field] = encryptSecret(trimmed);
    changed += 1;
  }

  if (changed === 0) {
    return { ok: false, message: "Nothing to save \u2014 every field was left blank." };
  }

  entry.updated_at = new Date().toISOString();
  row[gateway] = entry;

  const { error } = await admin.from("platform_settings").upsert({
    key: GATEWAY_CREDENTIALS_SETTINGS_KEY,
    value: row,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Saved ${changed} credential${changed === 1 ? "" : "s"}.` };
}

export async function clearGatewayStoredCredentials(
  gateway: GatewayName
): Promise<{ ok: boolean; message: string }> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", GATEWAY_CREDENTIALS_SETTINGS_KEY)
    .maybeSingle();

  const row = ((current?.value ?? {}) as StoredRow) ?? {};
  if (!row[gateway]) {
    return { ok: false, message: "There are no stored credentials to remove." };
  }

  delete row[gateway];

  const { error } = await admin.from("platform_settings").upsert({
    key: GATEWAY_CREDENTIALS_SETTINGS_KEY,
    value: row,
  });

  if (error) return { ok: false, message: error.message };

  const fallback =
    gateway === "paystack" ? env.paystackSecret : env.flutterwaveSecret;
  return {
    ok: true,
    message: fallback
      ? "Stored credentials removed. This gateway now uses the environment variables."
      : "Stored credentials removed. Checkout is blocked until new keys are provided.",
  };
}
