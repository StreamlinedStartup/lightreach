import { db, lists, leads } from '@workspace/db'
import { count } from 'drizzle-orm'
import { LeadsView } from './leads-view'

export default async function LeadsPage() {
  const allLists = await db.select().from(lists).orderBy(lists.createdAt)

  const leadCounts = await db
    .select({ listId: leads.listId, count: count() })
    .from(leads)
    .groupBy(leads.listId)

  const countMap = new Map(leadCounts.map((r) => [r.listId, r.count]))

  const listsWithCount = allLists.map((l) => ({
    ...l,
    leadCount: countMap.get(l.id) ?? 0,
    createdAt: l.createdAt.toISOString(),
  }))

  const allLeads = await db
    .select({
      id: leads.id,
      listId: leads.listId,
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      company: leads.company,
      status: leads.status,
    })
    .from(leads)
    .orderBy(leads.createdAt)

  return <LeadsView lists={listsWithCount} leads={allLeads} />
}
