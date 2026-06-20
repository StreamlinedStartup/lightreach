import { db, leads } from '@workspace/db'
import { SequenceEditor } from './sequence-editor'

export default async function NewSequencePage() {
  const allLeads = await db
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
    .limit(100)

  return <SequenceEditor leads={allLeads} />
}
