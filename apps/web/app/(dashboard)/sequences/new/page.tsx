import { db, leads } from '@workspace/db'
import { getUnsubscribeFooter } from '@/lib/unsubscribe-footer'
import { SequenceEditor } from './sequence-editor'

export default async function NewSequencePage() {
  const [allLeads, unsubscribeFooter] = await Promise.all([
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
    getUnsubscribeFooter(),
  ])

  return <SequenceEditor leads={allLeads} unsubscribeFooter={unsubscribeFooter} />
}
