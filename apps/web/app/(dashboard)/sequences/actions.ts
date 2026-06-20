'use server'

import { db, sequences, sequenceSteps } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type StepInput = {
  subject: string
  body: string
  delayDays: number
}

export async function createSequence(data: { name: string; steps: StepInput[] }) {
  const inserted = await db
    .insert(sequences)
    .values({ name: data.name })
    .returning({ id: sequences.id })

  const seqId = inserted[0]!.id

  if (data.steps.length > 0) {
    await db.insert(sequenceSteps).values(
      data.steps.map((s, i) => ({
        sequenceId: seqId,
        position: i + 1,
        subject: s.subject,
        body: s.body,
        delayDays: s.delayDays,
      }))
    )
  }

  revalidatePath('/sequences')
  return seqId
}

export async function updateSequence(
  id: number,
  data: { name: string; steps: StepInput[] }
) {
  await db
    .update(sequences)
    .set({ name: data.name, updatedAt: new Date() })
    .where(eq(sequences.id, id))

  await db.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, id))

  if (data.steps.length > 0) {
    await db.insert(sequenceSteps).values(
      data.steps.map((s, i) => ({
        sequenceId: id,
        position: i + 1,
        subject: s.subject,
        body: s.body,
        delayDays: s.delayDays,
      }))
    )
  }

  revalidatePath('/sequences')
  revalidatePath(`/sequences/${id}`)
}

export async function deleteSequence(id: number) {
  await db.delete(sequences).where(eq(sequences.id, id))
  revalidatePath('/sequences')
}
