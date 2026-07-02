'use server'
import { db, inboundEmails, appSettings, connections, messages, leads, lists } from '@workspace/db'
import { eq, and, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { decrypt } from '@workspace/core/crypto'
import { sendMail, buildMessageId } from '@workspace/core/email/transport'
import {
  pollAllInboxes,
  normalizeMessageId,
  matchLeadByReferences,
  matchLeadByEmail,
} from '@/lib/inbox-poller'
import { randomUUID } from 'crypto'

export async function markRead(id: number) {
  await db.update(inboundEmails).set({ isRead: true }).where(eq(inboundEmails.id, id))
  revalidatePath('/inbox')
}

export async function markUnread(id: number) {
  await db.update(inboundEmails).set({ isRead: false }).where(eq(inboundEmails.id, id))
  revalidatePath('/inbox')
}

export async function saveFilteredKeywords(keywords: string) {
  await db
    .insert(appSettings)
    .values({ key: 'filter_keywords', value: keywords })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: keywords, updatedAt: new Date() },
    })

  // Re-flag existing rows based on the new keyword list
  const kws = keywords
    .split(/[\n,]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)

  if (kws.length > 0) {
    const allEmails = await db
      .select({ id: inboundEmails.id, subject: inboundEmails.subject, bodyText: inboundEmails.bodyText })
      .from(inboundEmails)

    for (const row of allEmails) {
      const haystack = `${row.subject} ${row.bodyText ?? ''}`.toLowerCase()
      const isFiltered = kws.some((kw) => haystack.includes(kw))
      await db.update(inboundEmails).set({ isFiltered }).where(eq(inboundEmails.id, row.id))
    }
  } else {
    // No keywords → clear all filtered flags
    await db.update(inboundEmails).set({ isFiltered: false })
  }

  revalidatePath('/inbox')
}

// ---------------------------------------------------------------------------
// Thread resolution helper
// ---------------------------------------------------------------------------

/**
 * Given an inbound email, attempt to locate the originating outbound campaign
 * message by walking RFC822 threading headers (In-Reply-To / References →
 * messages.messageId). Falls back to a case-insensitive email address lookup
 * against the leads table.
 *
 * Returns { leadId, campaignId } if resolved, otherwise null.
 */
async function resolveThreadLead(
  inbound: { inReplyTo: string | null; references: string | null; fromEmail: string },
): Promise<{ leadId: number; campaignId: number | null } | null> {
  const byReferences = await matchLeadByReferences(inbound.inReplyTo, inbound.references)
  if (byReferences) return byReferences

  return matchLeadByEmail(inbound.fromEmail)
}

// ---------------------------------------------------------------------------
// Find or create a lead from an inbound sender (used when replying to someone
// who is not yet in the leads table, e.g. an email from an external contact).
// ---------------------------------------------------------------------------

async function findOrCreateLeadFromInbound(
  inbound: { fromEmail: string; fromName: string },
): Promise<number> {
  const email = inbound.fromEmail.toLowerCase().trim()

  // Return existing lead if one already exists for this address
  const [existing] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(sql`lower(${leads.email})`, email))
  if (existing) return existing.id

  // Find-or-create the "Inbox Replies" list that holds auto-created leads
  let [list] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.name, 'Inbox Replies'))
  if (!list) {
    ;[list] = await db
      .insert(lists)
      .values({ name: 'Inbox Replies' })
      .returning({ id: lists.id })
  }

  const [firstName, ...rest] = (inbound.fromName || '').trim().split(/\s+/)
  const [lead] = await db
    .insert(leads)
    .values({
      listId: list!.id,
      email,
      firstName: firstName ?? '',
      lastName: rest.join(' '),
      status: 'replied', // already in active conversation
    })
    .returning({ id: leads.id })

  return lead!.id
}

// ---------------------------------------------------------------------------
// Reply to inbound email
// ---------------------------------------------------------------------------

export async function replyToEmail(
  inboundId: number,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const [inbound] = await db
    .select()
    .from(inboundEmails)
    .where(eq(inboundEmails.id, inboundId))

  if (!inbound) return { ok: false, error: 'Message not found' }
  if (!inbound.connectionId) return { ok: false, error: 'No mailbox associated with this message' }

  const [conn] = await db.select().from(connections).where(eq(connections.id, inbound.connectionId))
  if (!conn) return { ok: false, error: 'Mailbox not found' }

  let smtpPass: string
  try {
    smtpPass = decrypt(conn.smtpPassEncrypted)
  } catch {
    return { ok: false, error: 'Failed to decrypt mailbox credentials' }
  }

  const subject = inbound.subject.startsWith('Re:')
    ? inbound.subject
    : `Re: ${inbound.subject}`

  const refsHeader = [inbound.references, inbound.messageId]
    .filter(Boolean)
    .join(' ')
    .trim() || undefined

  // Pre-generate so the messageId is always known and can be stored
  const outboundMessageId = buildMessageId(conn.fromEmail, randomUUID())

  try {
    await sendMail(
      {
        smtpHost: conn.smtpHost,
        smtpPort: conn.smtpPort,
        smtpSecure: conn.smtpSecure,
        smtpUser: conn.smtpUser,
        smtpPass,
      },
      {
        fromName: conn.fromName,
        fromEmail: conn.fromEmail,
        to: inbound.fromEmail,
        subject,
        html: body.replace(/\n/g, '<br>'),
        text: body,
        messageId: outboundMessageId,
        inReplyTo: inbound.messageId ?? undefined,
        references: refsHeader,
      },
    )

    // Persist the reply as a messages row so it shows in the thread view.
    // If the sender is not yet a lead, auto-create them in the "Inbox Replies"
    // list so the reply is always stored and visible in the conversation thread.
    const thread = await resolveThreadLead({
      inReplyTo: inbound.inReplyTo,
      references: inbound.references,
      fromEmail: inbound.fromEmail,
    })
    const leadId = thread?.leadId ?? await findOrCreateLeadFromInbound({
      fromEmail: inbound.fromEmail,
      fromName: inbound.fromName,
    })
    await db.insert(messages).values({
      campaignId: thread?.campaignId ?? null,
      leadId,
      connectionId: inbound.connectionId,
      stepPosition: 0, // 0 = manual reply, not a sequence step
      status: 'sent',
      sentAt: new Date(),
      messageId: normalizeMessageId(outboundMessageId),
      renderedSubject: subject,
      renderedBody: body,
    })

    await db.update(inboundEmails).set({ isRead: true, repliedAt: new Date() }).where(eq(inboundEmails.id, inboundId))
    revalidatePath('/inbox')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function categorizeEmail(id: number, category: string) {
  await db.update(inboundEmails).set({ category }).where(eq(inboundEmails.id, id))
  revalidatePath('/inbox')
}

export async function triggerFetch(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pollAllInboxes()
    revalidatePath('/inbox')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export type OutboundMessage = {
  id: number
  subject: string | null
  body: string | null
  sentAt: string | null
  fromEmail: string | null
}

/**
 * Fetch all sent outbound messages for the conversation thread.
 *
 * Resolves the thread via RFC822 headers (inReplyTo / references → messages.messageId)
 * with a case-insensitive email fallback — this is the reliable path that the inbox
 * poller already uses for bounce/reply classification.
 */
export async function getOutboundMessages(inboundId: number): Promise<OutboundMessage[]> {
  const [inbound] = await db
    .select({
      inReplyTo: inboundEmails.inReplyTo,
      references: inboundEmails.references,
      fromEmail: inboundEmails.fromEmail,
    })
    .from(inboundEmails)
    .where(eq(inboundEmails.id, inboundId))

  if (!inbound) return []

  const thread = await resolveThreadLead(inbound)
  if (!thread) return []

  const rows = await db
    .select({
      id: messages.id,
      subject: messages.renderedSubject,
      body: messages.renderedBody,
      sentAt: messages.sentAt,
      fromEmail: connections.fromEmail,
    })
    .from(messages)
    .leftJoin(connections, eq(messages.connectionId, connections.id))
    .where(and(eq(messages.status, 'sent'), eq(messages.leadId, thread.leadId)))

  return rows.map((r) => {
    let sentAt: string | null = null
    if (r.sentAt) {
      sentAt = r.sentAt instanceof Date
        ? r.sentAt.toISOString()
        : new Date((r.sentAt as unknown as number) * 1000).toISOString()
    }
    return {
      id: r.id,
      subject: r.subject ?? null,
      body: r.body ?? null,
      sentAt,
      fromEmail: r.fromEmail ?? null,
    }
  })
}
