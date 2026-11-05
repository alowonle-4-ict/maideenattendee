import "server-only";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
  secretsEncryptionConfigured,
} from "@/lib/secrets/crypto";
import type { GatewayKeyMode, GatewayName } from "@/lib/payments/types";

export const GATEWAY_CREDENTIALS_SETTINGS_KEY = "payment_gateway_credentials";

type StoredEntry = Record<string, string>;
type StoredRow = Partial<Record<GatewayName, StoredEntry>>;

export type CredentialSource = "stored" | "environment" | "none";

export interface GatewayCredentialField {
  field: string;
  label: string;
  secret: boolean;
  /** Masked for secret fields, shown in full otherwise. Empty when unset. */
  preview: string;
  source: CredentialSource;
}

export interface GatewayCredentialSummary {
  gateway: GatewayName;
  updatedAt: string | null;
  fields: GatewayCredentialField[];
  secretSource: CredentialSource;
}

export interface ResolvedGatewaySecrets {
  paystack: { secretKey: string; publicKey: string; keyMode: GatewayKeyMode; source: CredentialSource };
  flutterwave: {
    secretKey: string;
    secretHash: string;
    publicKey: string;
    keyMode: GatewayKeyMode;
    source: CredentialSource;
  };
}

interface CredentialFieldSpec {
  field: string;
  label: string;
  /** Secret fields are encrypted at rest and masked in the dashboard. */
  secret: boolean;
  environment: () => string;
}

const CREDENTIAL_FIELDS: Record<GatewayName, CredentialFieldSpec[]> = {
  paystack: [
    { field: "secret_key", label: "Secret key", secret: true, environment: () => env.paystackSecret },
    { field: "public_key", label: "Public key", secret: false, environment: () => env.paystackPublic },
  ],
  flutterwave: [
    { field: "secret_key", label: "Secret key", secret: true, environment: () => env.flutterwaveSecret },
    { field: "secret_hash", label: "Webhook secret hash", secret: true, environment: () => env.flutterwaveHash },
    { field: "public_key", label: "Public key", secret: false, environment: () => env.flutterwavePublic },
  ],
};

/**
 * A test key is always reported as test, even when only one half of the pair is
 * known, so the dashboard can never claim live keys by accident.
 */
export function detectKeyMode(gateway: GatewayName, keys: string[]): GatewayKeyMode {
  const values = keys.map((value) => (value ?? "").trim()).filter(Boolean);
  if (gateway === "paystack") {
    if (values.some((value) => /^(sk|pk)_test_/i.test(value))) return "test";
    if (values.some((value) => /^(sk|pk)_live_/i.test(value))) return "live";
    return "unknown";
  }
  if (values.some((value) => /^flw(seck|pubk)[-_]test/i.test(value))) return "test";
  if (values.some((value) => /^flw(seck|pubk)[-_]/i.test(value))) return "live";
  return "unknown";
}

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

function readField(
  entry: StoredEntry | undefined,
  spec: CredentialFieldSpec
): { value: string; source: CredentialSource } {
  const raw = entry?.[spec.field];
  const stored = spec.secret ? decryptSecret(raw) : (raw ?? null);
  if (stored) return { value: stored, source: "stored" };
  const fallback = spec.environment();
  if (fallback) return { value: fallback, source: "environment" };
  return { value: "", source: "none" };
}

function valuesFor(gateway: GatewayName, entry: StoredEntry | undefined) {
  return CREDENTIAL_FIELDS[gateway].map((spec) => ({ spec, ...readField(entry, spec) }));
}

/**
 * Server-side only. Dashboard-managed credentials take precedence over the
 * matching environment variables so a key can be rotated without a redeploy.
 */
export async function resolveGatewaySecrets(): Promise<ResolvedGatewaySecrets> {
  const row = await readStoredRow();
  const paystack = valuesFor("paystack", row.paystack);
  const flutterwave = valuesFor("flutterwave", row.flutterwave);

  const get = (fields: ReturnType<typeof valuesFor>, field: string) =>
    fields.find((item) => item.spec.field === field);

  const paystackSecret = get(paystack, "secret_key")!;
  const paystackPublic = get(paystack, "public_key")!;
  const flutterwaveSecret = get(flutterwave, "secret_key")!;
  const flutterwaveHash = get(flutterwave, "secret_hash")!;
  const flutterwavePublic = get(flutterwave, "public_key")!;

  return {
    paystack: {
      secretKey: paystackSecret.value,
      publicKey: paystackPublic.value,
      keyMode: detectKeyMode("paystack", [paystackSecret.value, paystackPublic.value]),
      source: paystackSecret.source,
    },
    flutterwave: {
      secretKey: flutterwaveSecret.value,
      secretHash: flutterwaveHash.value,
      publicKey: flutterwavePublic.value,
      keyMode: detectKeyMode("flutterwave", [
        flutterwaveSecret.value,
        flutterwavePublic.value,
      ]),
      source: flutterwaveSecret.source,
    },
  };
}

/** Dashboard view of every credential. Secret fields are never returned in plaintext. */
export async function getGatewayCredentialSummaries(): Promise<GatewayCredentialSummary[]> {
  const row = await readStoredRow();

  return (["paystack", "flutterwave"] as GatewayName[]).map((gateway) => {
    const fields = valuesFor(gateway, row[gateway]);
    return {
      gateway,
      updatedAt: row[gateway]?.updated_at ?? null,
      fields: fields.map(({ spec, value, source }) => ({
        field: spec.field,
        label: spec.label,
        secret: spec.secret,
        preview: value ? (spec.secret ? maskSecret(value) : value) : "",
        source,
      })),
      secretSource: fields.map((f) => f.source).find((source) => source !== "none") ?? "none",
    };
  });
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

  const specs = new Map(CREDENTIAL_FIELDS[gateway].map((spec) => [spec.field, spec]));

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
    const spec = specs.get(field);
    if (!spec) continue;
    const trimmed = value?.trim() ?? "";
    if (!trimmed) continue;
    entry[field] = spec.secret ? encryptSecret(trimmed) : trimmed;
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
