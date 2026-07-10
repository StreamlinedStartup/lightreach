import {
  db,
  messages,
  campaigns,
  leads,
  connections,
  sequenceSteps,
  campaignConnections,
  appSettings,
} from '@workspace/db'
import { eq, or, desc, asc, and } from 'drizzle-orm'
import { renderVariables } from '@workspace/core/variables'
import {
  appendUnsubscribeFooter,
  DEFAULT_UNSUBSCRIBE_TEXT,
} from '@workspace/core/email/transport'
import { EmailsView } from './emails-view'

export type EmailRow = {
  id: number
  status: string
  stepPosition: number
  scheduledAt: string | null
  sentAt: string | null
  /** renderedSubject for sent; templateSubject for queued/scheduled */
  subject: string | null
  /** renderedBody for sent; templateBody for queued/scheduled */
  body: string | null
  error: string | null
  campaignName: string | null
  leadEmail: string
  leadFirstName: string
  leadLastName: string
  fromEmail: string | null
  fromName: string | null
}

const MESSAGE_FIELDS = {
  id: messages.id,
  campaignId: messages.campaignId,
  status: messages.status,
  stepPosition: messages.stepPosition,
  scheduledAt: messages.scheduledAt,
  sentAt: messages.sentAt,
  renderedSubject: messages.renderedSubject,
  renderedBody: messages.renderedBody,
  connectionId: messages.connectionId,
  error: messages.error,
  campaignName: campaigns.name,
  leadEmail: leads.email,
  leadFirstName: leads.firstName,
  leadLastName: leads.lastName,
  leadCompany: leads.company,
  leadOpeningLine: leads.openingLine,
  leadCustomFields: leads.customFields,
  fromEmail: connections.fromEmail,
  fromName: connections.fromName,
  templateSubject: sequenceSteps.subject,
  templateBody: sequenceSteps.body,
}

function toRow(
  r: {
    id: number
    campaignId: number | null
    status: string
    stepPosition: number
    scheduledAt: Date | null
    sentAt: Date | null
    renderedSubject: string | null
    renderedBody: string | null
    connectionId: number | null
    error: string | null
    campaignName: string | null
    leadEmail: string | null
    leadFirstName: string | null
    leadLastName: string | null
    leadCompany: string | null
    leadOpeningLine: string | null
    leadCustomFields: Record<string, string> | null
    fromEmail: string | null
    fromName: string | null
    templateSubject: string | null
    templateBody: string | null
  },
  campaignFromMap: Map<number, { fromEmail: string; fromName: string }>,
  footerText: string,
): EmailRow {
  // For queued/scheduled emails the message body isn't rendered yet (that
  // happens at send time). Resolve {{variable|fallback}} placeholders against
  // the lead so the preview shows real values instead of raw template syntax.
  // Spintax ({a|b}) is intentionally left unexpanded — the actual pick isn't
  // decided until send.
  const vars = {
    firstName: r.leadFirstName,
    lastName: r.leadLastName,
    email: r.leadEmail,
    company: r.leadCompany,
    openingLine: r.leadOpeningLine,
    ...(r.leadCustomFields ?? {}),
  }

  // Use rendered subject if available, else render the template's variables
  const subject = r.renderedSubject ?? (r.templateSubject != null ? renderVariables(r.templateSubject, vars) : null)
  // Same for body
  let body = r.renderedBody ?? (r.templateBody != null ? renderVariables(r.templateBody, vars) : null)
  // Sent bodies already have the opt-out footer baked in; queued/scheduled ones
  // don't (rendering happens at send time), so append it here so the preview
  // matches what will actually be delivered.
  if (r.renderedBody == null && body != null) {
    body = appendUnsubscribeFooter(body, footerText)
  }

  // Use the message's assigned connection; fall back to any connection on the campaign
  let fromEmail = r.fromEmail
  let fromName = r.fromName
  if (!fromEmail) {
    const fallback = r.campaignId != null ? campaignFromMap.get(r.campaignId) : undefined
    if (fallback) {
      fromEmail = fallback.fromEmail
      fromName = fallback.fromName
    }
  }

  return {
    id: r.id,
    status: r.status,
    stepPosition: r.stepPosition,
    subject,
    body,
    error: r.error,
    campaignName: r.campaignName,
    leadEmail: r.leadEmail ?? '',
    leadFirstName: r.leadFirstName ?? '',
    leadLastName: r.leadLastName ?? '',
    fromEmail,
    fromName,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
  }
}

export default async function EmailsPage() {
  const [scheduledRaw, sentRaw, campaignConnRows, footerRows] = await Promise.all([
    db
      .select(MESSAGE_FIELDS)
      .from(messages)
      .leftJoin(campaigns, eq(messages.campaignId, campaigns.id))
      .leftJoin(leads, eq(messages.leadId, leads.id))
      .leftJoin(connections, eq(messages.connectionId, connections.id))
      .leftJoin(
        sequenceSteps,
        and(
          eq(sequenceSteps.sequenceId, campaigns.sequenceId!),
          eq(sequenceSteps.position, messages.stepPosition),
        ),
      )
      .where(or(eq(messages.status, 'queued'), eq(messages.status, 'sending')))
      .orderBy(asc(messages.scheduledAt))
      .limit(500),

    db
      .select(MESSAGE_FIELDS)
      .from(messages)
      .leftJoin(campaigns, eq(messages.campaignId, campaigns.id))
      .leftJoin(leads, eq(messages.leadId, leads.id))
      .leftJoin(connections, eq(messages.connectionId, connections.id))
      .leftJoin(
        sequenceSteps,
        and(
          eq(sequenceSteps.sequenceId, campaigns.sequenceId!),
          eq(sequenceSteps.position, messages.stepPosition),
        ),
      )
      .where(eq(messages.status, 'sent'))
      .orderBy(desc(messages.sentAt))
      .limit(500),

    // First connection per campaign — used as fallback From when message has no connectionId
    db
      .select({
        campaignId: campaignConnections.campaignId,
        fromEmail: connections.fromEmail,
        fromName: connections.fromName,
      })
      .from(campaignConnections)
      .leftJoin(connections, eq(campaignConnections.connectionId, connections.id)),

    // Opt-out footer to mirror in the preview of not-yet-sent emails.
    db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'unsubscribe_footer')),
  ])

  const unsubscribeFooter = footerRows[0]?.value || DEFAULT_UNSUBSCRIBE_TEXT

  // Build map: campaignId → first connection with a real fromEmail
  const campaignFromMap = new Map<number, { fromEmail: string; fromName: string }>()
  for (const row of campaignConnRows) {
    if (!campaignFromMap.has(row.campaignId) && row.fromEmail) {
      campaignFromMap.set(row.campaignId, {
        fromEmail: row.fromEmail,
        fromName: row.fromName ?? '',
      })
    }
  }

  return (
    <EmailsView
      scheduled={scheduledRaw.map((r) => toRow(r, campaignFromMap, unsubscribeFooter))}
      sent={sentRaw.map((r) => toRow(r, campaignFromMap, unsubscribeFooter))}
    />
  )
}
