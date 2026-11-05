import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const VERSION = "v1";

function masterKey(): Buffer | null {
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) return null;
  return /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Generated with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Changing this value invalidates every credential already stored on the platform.
 */
export function secretsEncryptionKeySource(): "hex" | "passphrase" | "missing" {
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) return "missing";
  return /^[0-9a-fA-F]{64}$/.test(raw) ? "hex" : "passphrase";
}

export function secretsEncryptionConfigured() {
  return masterKey() !== null;
}

export const SECRETS_ENCRYPTION_MESSAGE =
  "Credential storage is not enabled on this server. Set SECRETS_ENCRYPTION_KEY as a server-side environment variable (a 64-character hex key, or any long random passphrase), redeploy, and reload this page.";

export function encryptSecret(plaintext: string): string {
  const key = masterKey();
  if (!key) throw new Error(SECRETS_ENCRYPTION_MESSAGE);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Returns null when the blob is foreign, truncated, or was encrypted with a different key. */
export function decryptSecret(stored: string | null | undefined): string | null {
  const key = masterKey();
  if (!key || !stored) return null;
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  const tail = value.slice(-4);
  return `\u2022\u2022\u2022\u2022\u2022\u2022${tail}`;
}
