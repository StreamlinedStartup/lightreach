import { db, campaigns, sequences, lists, leads, messages } from '@workspace/db'
import { eq, count, desc } from 'drizzle-orm'
import { CampaignsView } from './campaigns-view'

export default async function CampaignsPage() {
  const [campaignRows, leadCountsRaw, sentCountsRaw] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        status: campaigns.status,
        sequenceId: campaigns.sequenceId,
        sequenceName: sequences.name,
        listId: campaigns.listId,
        listName: lists.name,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .leftJoin(sequences, eq(sequences.id, campaigns.sequenceId))
      .leftJoin(lists, eq(lists.id, campaigns.listId))
      .orderBy(desc(campaigns.createdAt)),

    db.select({ listId: leads.listId, total: count() }).from(leads).groupBy(leads.listId),

    db
      .select({ campaignId: messages.campaignId, total: count() })
      .from(messages)
      .where(eq(messages.status, 'sent'))
      .groupBy(messages.campaignId),
  ])

  const leadCountMap = new Map(leadCountsRaw.map((r) => [r.listId, r.total]))
  const sentCountMap = new Map(sentCountsRaw.map((r) => [r.campaignId, r.total]))

  const campaignData = campaignRows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    sequenceName: row.sequenceName ?? null,
    listName: row.listName ?? null,
    leadCount: row.listId !== null ? (leadCountMap.get(row.listId) ?? 0) : null,
    sentCount: sentCountMap.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }))

  return <CampaignsView campaigns={campaignData} />
}
