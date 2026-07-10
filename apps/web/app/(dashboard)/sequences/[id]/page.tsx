import { notFound } from 'next/navigation'
import { db, leads, sequences, sequenceSteps, appSettings } from '@workspace/db'
import { eq, asc } from 'drizzle-orm'
import { DEFAULT_UNSUBSCRIBE_TEXT } from '@workspace/core/email/transport'
import { SequenceEditor } from '../new/sequence-editor'

export default async function EditSequencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const seqId = Number(id)
  if (isNaN(seqId)) notFound()

  const [seq] = await db.select().from(sequences).where(eq(sequences.id, seqId))
  if (!seq) notFound()

  const steps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, seqId))
    .orderBy(asc(sequenceSteps.position))

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

  const [footerRow] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, 'unsubscribe_footer'))
  const unsubscribeFooter = footerRow?.value || DEFAULT_UNSUBSCRIBE_TEXT

  return (
    <SequenceEditor
      leads={allLeads}
      editId={seqId}
      unsubscribeFooter={unsubscribeFooter}
      initialName={seq.name}
      initialSteps={steps.map((s) => ({
        subject: s.subject,
        body: s.body,
        delayDays: s.delayDays,
        sameThread: s.sameThread,
      }))}
    />
  )
}
