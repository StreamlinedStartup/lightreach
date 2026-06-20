/**
 * AES-256-GCM encryption for sensitive values (SMTP passwords).
 *
 * Uses Node.js built-in `crypto` module — no external dependencies.
 *
 * Environment:
 *   APP_ENCRYPTION_KEY  64 hex characters (= 32 bytes)
 *   Generate with:  openssl rand -hex 32
 *
 * Ciphertext format (base64url):
 *   <12-byte IV> + <ciphertext> + <16-byte auth tag>
 *   All concatenated, then base64url-encoded.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env["APP_ENCRYPTION_KEY"];
  if (!hex || hex.length !== 64) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string. Returns a base64url-encoded ciphertext.
 * Throws if APP_ENCRYPTION_KEY is not configured.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Pack: iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64url");
}

/**
 * Decrypt a base64url-encoded ciphertext produced by `encrypt()`.
 * Returns the original plaintext string.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const combined = Buffer.from(ciphertext, "base64url");

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final("utf8");
}
