'use server'
import { db, inboundEmails, appSettings, connections } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { decrypt } from '@workspace/core/crypto'
import { sendMail } from '@workspace/core/email/transport'
import { pollAllInboxes } from '@/lib/inbox-poller'

export async function markRead(id: number) {
  await db.update(inboundEmails).set({ isRead: true }).where(eq(inboundEmails.id, id))
  revalidatePath('/inbox')
}

export async function markUnread(id: number) {
  await db.update(inboundEmails).set({ isRead: false }).where(eq(inboundEmails.id, id))
  revalidatePath('/inbox')
}

export async function saveWarmupKeywords(keywords: string) {
  await db
    .insert(appSettings)
    .values({ key: 'warmup_keywords', value: keywords })
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
      const isWarmup = kws.some((kw) => haystack.includes(kw))
      await db.update(inboundEmails).set({ isWarmup }).where(eq(inboundEmails.id, row.id))
    }
  } else {
    // No keywords → clear all warmup flags
    await db.update(inboundEmails).set({ isWarmup: false })
  }

  revalidatePath('/inbox')
}

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
        inReplyTo: inbound.messageId ?? undefined,
        references: refsHeader,
      },
    )

    await db.update(inboundEmails).set({ isRead: true }).where(eq(inboundEmails.id, inboundId))
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
