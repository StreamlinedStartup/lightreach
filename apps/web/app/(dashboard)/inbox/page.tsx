import { db, inboundEmails, connections, appSettings } from '@workspace/db'
import { eq, desc } from 'drizzle-orm'
import { InboxView } from './inbox-view'

export type InboundRow = {
  id: number
  fromName: string
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  isWarmup: boolean
  isRead: boolean
  category: string
  receivedAt: string | null
  connectionId: number | null
  connectionLabel: string | null
  connectionFromEmail: string | null
  messageId: string | null
  inReplyTo: string | null
  references: string | null
}

export default async function InboxPage() {
  const [rawEmails, keywordRow] = await Promise.all([
    db
      .select({
        id: inboundEmails.id,
        fromName: inboundEmails.fromName,
        fromEmail: inboundEmails.fromEmail,
        toEmail: inboundEmails.toEmail,
        subject: inboundEmails.subject,
        bodyText: inboundEmails.bodyText,
        bodyHtml: inboundEmails.bodyHtml,
        isWarmup: inboundEmails.isWarmup,
        isRead: inboundEmails.isRead,
        category: inboundEmails.category,
        receivedAt: inboundEmails.receivedAt,
        connectionId: inboundEmails.connectionId,
        connectionLabel: connections.label,
        connectionFromEmail: connections.fromEmail,
        messageId: inboundEmails.messageId,
        inReplyTo: inboundEmails.inReplyTo,
        references: inboundEmails.references,
      })
      .from(inboundEmails)
      .leftJoin(connections, eq(inboundEmails.connectionId, connections.id))
      .orderBy(desc(inboundEmails.receivedAt))
      .limit(500),

    db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'warmup_keywords')),
  ])

  const rows: InboundRow[] = rawEmails.map((r) => ({
    ...r,
    receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null,
  }))

  return (
    <InboxView
      emails={rows}
      warmupKeywords={keywordRow[0]?.value ?? ''}
    />
  )
}
