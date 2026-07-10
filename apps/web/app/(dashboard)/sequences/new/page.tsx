import { db, leads, appSettings } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { DEFAULT_UNSUBSCRIBE_TEXT } from '@workspace/core/email/transport'
import { SequenceEditor } from './sequence-editor'

export default async function NewSequencePage() {
  const [allLeads, footerRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        company: leads.company,
        openingLine: leads.openingLine,
        customFields: leads.customFields,
      })
      .from(leads)
      .limit(100),
    db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'unsubscribe_footer')),
  ])

  const unsubscribeFooter = footerRows[0]?.value || DEFAULT_UNSUBSCRIBE_TEXT

  return <SequenceEditor leads={allLeads} unsubscribeFooter={unsubscribeFooter} />
}
