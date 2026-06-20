import { db } from '@workspace/db'
import { connections, inboundEmails, appSettings } from '@workspace/db/schema'
import { decrypt } from '@workspace/core/crypto'
import { resolveImapConfig, fetchRecent } from '@workspace/core/email/imap'
import { eq, max } from 'drizzle-orm'

const TICK_MS = 120_000

let pollerHandle: ReturnType<typeof setInterval> | null = null

export function startInboxPoller(): void {
  if (pollerHandle) {
    console.log('[Lightreach] Inbox poller already running.')
    return
  }

  console.log('[Lightreach] Inbox poller started. Tick interval:', TICK_MS, 'ms')

  pollerHandle = setInterval(() => {
    pollAllInboxes().catch((err) => {
      console.error('[Lightreach] Inbox poller tick error:', err)
    })
  }, TICK_MS)

  pollAllInboxes().catch((err) => {
    console.error('[Lightreach] Inbox poller startup error:', err)
  })

  pollerHandle.unref()
}

export function stopInboxPoller(): void {
  if (pollerHandle) {
    clearInterval(pollerHandle)
    pollerHandle = null
    console.log('[Lightreach] Inbox poller stopped.')
  }
}

async function getWarmupKeywords(): Promise<string[]> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, 'warmup_keywords'))
  if (!row?.value?.trim()) return []
  return row.value
    .split(/[\n,]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
}

function isWarmupMatch(subject: string, bodyText: string | null, keywords: string[]): boolean {
  if (keywords.length === 0) return false
  const haystack = `${subject} ${bodyText ?? ''}`.toLowerCase()
  return keywords.some((kw) => haystack.includes(kw))
}

export async function pollAllInboxes(): Promise<void> {
  const allConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.imapEnabled, true))

  if (allConnections.length === 0) return

  const keywords = await getWarmupKeywords()

  for (const conn of allConnections) {
    try {
      const imapConfig = resolveImapConfig(conn, decrypt)
      if (!imapConfig) continue

      // Find the highest UID we already have for this connection
      const [uidRow] = await db
        .select({ maxUid: max(inboundEmails.uid) })
        .from(inboundEmails)
        .where(eq(inboundEmails.connectionId, conn.id))

      const sinceUid = uidRow?.maxUid ?? 0

      const emails = await fetchRecent(imapConfig, { sinceUid, limit: 100 })

      for (const email of emails) {
        const warmup = isWarmupMatch(email.subject, email.bodyText, keywords)

        await db
          .insert(inboundEmails)
          .values({
            connectionId: conn.id,
            uid: email.uid,
            messageId: email.messageId,
            inReplyTo: email.inReplyTo,
            references: email.references,
            fromName: email.fromName,
            fromEmail: email.fromEmail,
            toEmail: email.toEmail,
            subject: email.subject,
            bodyText: email.bodyText,
            bodyHtml: email.bodyHtml,
            isWarmup: warmup,
            receivedAt: email.receivedAt,
          })
          .onConflictDoNothing()
      }

      if (emails.length > 0) {
        console.log(
          `[Lightreach] Inbox: fetched ${emails.length} new message(s) for connection ${conn.id} (${conn.fromEmail})`,
        )
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(
        `[Lightreach] Inbox poller error for connection ${conn.id} (${conn.fromEmail}):`,
        errMsg,
      )
      await db
        .update(connections)
        .set({ lastError: `IMAP: ${errMsg}` })
        .where(eq(connections.id, conn.id))
    }
  }
}
