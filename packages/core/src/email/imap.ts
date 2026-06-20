/**
 * IMAP client utilities for fetching inbound email.
 *
 * IMPORTANT: This module runs server-side only (Node.js).
 * Never import it from 'use client' files.
 *
 * Usage:
 *   import { fetchRecent, verifyImap, resolveImapConfig } from '@workspace/core/email/imap'
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { AddressObject } from "mailparser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IMAPConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  /** Decrypted plaintext password */
  imapPass: string;
}

export interface ParsedEmail {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  /** Space-separated message-id list from the References header */
  references: string | null;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date | null;
}

/** Minimal DB connection shape needed to resolve IMAP config. */
export interface ConnectionLike {
  smtpHost: string;
  smtpUser: string;
  smtpPassEncrypted: string;
  imapEnabled: boolean;
  imapSameAsSmtp: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean | null;
  imapUser: string | null;
  imapPassEncrypted: string | null;
}

// ---------------------------------------------------------------------------
// SMTP → IMAP host derivation
// ---------------------------------------------------------------------------

const SMTP_TO_IMAP: Record<string, string> = {
  "smtp.gmail.com": "imap.gmail.com",
  "smtp.office365.com": "outlook.office365.com",
  "smtp-mail.outlook.com": "outlook.office365.com",
  "smtp.mail.yahoo.com": "imap.mail.yahoo.com",
  "smtp.zoho.com": "imap.zoho.com",
};

function deriveImapHost(smtpHost: string): string {
  const lower = smtpHost.toLowerCase();
  if (SMTP_TO_IMAP[lower]) return SMTP_TO_IMAP[lower]!;
  // Generic fallback: replace leading "smtp" with "imap"
  if (lower.startsWith("smtp")) return "imap" + lower.slice(4);
  return lower;
}

// ---------------------------------------------------------------------------
// Config resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the effective IMAP config for a connection.
 * Returns null if IMAP is not enabled.
 * The `decrypt` function is passed in to avoid circular dependency with core/crypto.
 */
export function resolveImapConfig(
  conn: ConnectionLike,
  decrypt: (ciphertext: string) => string,
): IMAPConfig | null {
  if (!conn.imapEnabled) return null;

  if (conn.imapSameAsSmtp) {
    return {
      imapHost: deriveImapHost(conn.smtpHost),
      imapPort: 993,
      imapSecure: true,
      imapUser: conn.smtpUser,
      imapPass: decrypt(conn.smtpPassEncrypted),
    };
  }

  if (!conn.imapHost || !conn.imapUser || !conn.imapPassEncrypted) return null;

  return {
    imapHost: conn.imapHost,
    imapPort: conn.imapPort ?? 993,
    imapSecure: conn.imapSecure ?? true,
    imapUser: conn.imapUser,
    imapPass: decrypt(conn.imapPassEncrypted),
  };
}

// ---------------------------------------------------------------------------
// Client builder
// ---------------------------------------------------------------------------

function buildClient(config: IMAPConfig): ImapFlow {
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: {
      user: config.imapUser,
      pass: config.imapPass,
    },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
}

// ---------------------------------------------------------------------------
// Verify IMAP connection
// ---------------------------------------------------------------------------

/**
 * Verify that the IMAP connection credentials are accepted.
 */
export async function verifyImap(
  config: IMAPConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = buildClient(config);
  try {
    await client.connect();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }
}

// ---------------------------------------------------------------------------
// Fetch recent messages
// ---------------------------------------------------------------------------

function extractAddress(addr: AddressObject | AddressObject[] | undefined): {
  name: string;
  email: string;
} {
  const obj = Array.isArray(addr) ? addr[0] : addr;
  const val = obj?.value?.[0];
  return {
    name: val?.name ?? "",
    email: val?.address ?? "",
  };
}

/**
 * Fetch messages from the INBOX with UID > sinceUid (or the last `limit` messages
 * if sinceUid is 0 / undefined and this is the first sync).
 */
export async function fetchRecent(
  config: IMAPConfig,
  opts: { sinceUid?: number; limit?: number } = {},
): Promise<ParsedEmail[]> {
  const client = buildClient(config);
  const results: ParsedEmail[] = [];

  try {
    await client.connect();

    const mailbox = await client.mailboxOpen("INBOX");
    if (mailbox.exists === 0) return results;

    const sinceUid = opts.sinceUid ?? 0;
    const limit = opts.limit ?? 100;

    // Build UID range: sinceUid+1:* to get everything newer
    // If this is the very first sync (sinceUid=0), cap at last `limit` messages by UID
    let range: string;
    if (sinceUid > 0) {
      range = `${sinceUid + 1}:*`;
    } else {
      // Start from the last `limit` UIDs
      const totalUids = mailbox.uidNext - 1;
      const startUid = Math.max(1, totalUids - limit + 1);
      range = `${startUid}:*`;
    }

    for await (const msg of client.fetch(range, { uid: true, source: true }, { uid: true })) {
      if (!msg.source) continue;

      const parsed = await simpleParser(msg.source);

      const from = extractAddress(parsed.from);
      const to = extractAddress(parsed.to);

      // References can be a string or string[]
      let refsStr: string | null = null;
      if (parsed.references) {
        if (Array.isArray(parsed.references)) {
          refsStr = parsed.references.join(" ");
        } else {
          refsStr = parsed.references;
        }
      }

      results.push({
        uid: msg.uid,
        messageId: parsed.messageId ?? null,
        inReplyTo: parsed.inReplyTo ?? null,
        references: refsStr,
        fromName: from.name,
        fromEmail: from.email,
        toEmail: to.email,
        subject: parsed.subject ?? "",
        bodyText: parsed.text ?? null,
        bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
        receivedAt: parsed.date ?? null,
      });
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }

  return results;
}
