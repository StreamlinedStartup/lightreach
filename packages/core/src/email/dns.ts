/**
 * DNS-based email authentication checks (SPF / DKIM / DMARC) for a sending domain.
 *
 * IMPORTANT: This module runs server-side only (Node.js).
 * Never import it from 'use client' files.
 *
 * DKIM has no fixed DNS location — the record lives at
 * `<selector>._domainkey.<domain>` and the selector is chosen by whichever mail
 * provider generated the key (Google, Microsoft, etc). Since Lightreach doesn't
 * know the selector in advance, DKIM is checked by probing a list of common
 * provider selectors; it passes if any of them resolves to a key record.
 *
 * Usage:
 *   import { checkDomainAuth, domainFromEmail } from '@workspace/core/email/dns'
 */

import { resolveTxt } from "dns/promises";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DnsAuthResult {
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  /** true only when spf, dkim, and dmarc are all true */
  valid: boolean;
  /** ISO timestamp of when the check ran */
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Common DKIM selectors used by major ESPs and mail providers. */
const COMMON_DKIM_SELECTORS = [
  "google",
  "selector1",
  "selector2",
  "default",
  "dkim",
  "k1",
  "mail",
  "smtp",
  "mandrill",
  "sendgrid",
  "mx",
  "s1",
  "s2",
] as const;

/** Per-lookup timeout so a hanging DNS resolver can't stall the caller. */
const LOOKUP_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the domain from an email address (lowercased). Returns null if malformed. */
export function domainFromEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/** resolveTxt with a timeout guard; resolves to [] on any error/timeout. */
async function safeResolveTxt(hostname: string): Promise<string[][]> {
  try {
    return await Promise.race([
      resolveTxt(hostname),
      new Promise<string[][]>((_, reject) =>
        setTimeout(() => reject(new Error("DNS lookup timed out")), LOOKUP_TIMEOUT_MS),
      ),
    ]);
  } catch {
    return [];
  }
}

function joinRecords(records: string[][]): string[] {
  return records.map((chunks) => chunks.join(""));
}

async function checkSpf(domain: string): Promise<boolean> {
  const records = joinRecords(await safeResolveTxt(domain));
  const spfRecords = records.filter((r) => r.toLowerCase().startsWith("v=spf1"));
  // RFC 7208: more than one SPF record for a domain is itself a permanent
  // error that breaks SPF evaluation — that must NOT count as a pass.
  return spfRecords.length === 1;
}

async function checkDmarc(domain: string): Promise<boolean> {
  const records = joinRecords(await safeResolveTxt(`_dmarc.${domain}`));
  const dmarcRecords = records.filter((r) => r.toLowerCase().startsWith("v=dmarc1"));
  // RFC 7489 §6.6.3: multiple DMARC TXT records at the same name means none are valid.
  return dmarcRecords.length === 1;
}

/**
 * A DKIM TXT record is only a valid, active key when its `p=` tag carries an
 * actual base64 public key. Per RFC 6376 §3.6.1, an empty `p=` tag means the
 * key has been explicitly revoked — that must NOT count as a pass. Also
 * require the record to actually declare itself as DKIM (`v=DKIM1`, or no `v=`
 * tag at all — RFC 6376 §3.6.1 allows omitting it) so an unrelated TXT record
 * that happens to contain "p=..." at that hostname doesn't false-positive.
 */
function hasActiveDkimKey(record: string): boolean {
  const versionMatch = /(?:^|;)\s*v=([^;]*)/i.exec(record);
  if (versionMatch && versionMatch[1]!.trim().toUpperCase() !== "DKIM1") return false;

  const match = /(?:^|;)\s*p=([^;]*)/i.exec(record);
  if (!match) return false;
  return match[1]!.trim().length > 0;
}

async function checkDkim(domain: string): Promise<boolean> {
  const results = await Promise.allSettled(
    COMMON_DKIM_SELECTORS.map(async (selector) => {
      const records = joinRecords(await safeResolveTxt(`${selector}._domainkey.${domain}`));
      return records.some(hasActiveDkimKey);
    }),
  );
  return results.some((r) => r.status === "fulfilled" && r.value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check SPF, DKIM, and DMARC records for a domain. Never throws — individual
 * lookup failures (NXDOMAIN, timeout, malformed records) resolve to `false`
 * for that record rather than rejecting the whole check.
 */
export async function checkDomainAuth(domain: string): Promise<DnsAuthResult> {
  const [spf, dkim, dmarc] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain),
    checkDmarc(domain),
  ]);

  return {
    spf,
    dkim,
    dmarc,
    valid: spf && dkim && dmarc,
    checkedAt: new Date().toISOString(),
  };
}
