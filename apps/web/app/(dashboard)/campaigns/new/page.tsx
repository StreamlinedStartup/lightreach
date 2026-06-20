import { db, sequences, lists, connections } from '@workspace/db'
import { desc } from 'drizzle-orm'
import { CampaignForm } from './campaign-form'

export default async function NewCampaignPage() {
  const [allSequences, allLists, allConnections] = await Promise.all([
    db
      .select({ id: sequences.id, name: sequences.name })
      .from(sequences)
      .orderBy(desc(sequences.createdAt)),

    db
      .select({ id: lists.id, name: lists.name })
      .from(lists)
      .orderBy(desc(lists.createdAt)),

    db
      .select({
        id: connections.id,
        label: connections.label,
        fromEmail: connections.fromEmail,
        status: connections.status,
        dailyLimit: connections.dailyLimit,
      })
      .from(connections)
      .orderBy(connections.label),
  ])

  return (
    <CampaignForm
      sequences={allSequences}
      lists={allLists}
      connections={allConnections}
    />
  )
}
