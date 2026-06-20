'use server'

import { db, campaigns, campaignConnections, messages, leads } from '@workspace/db'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type CreateCampaignInput = {
  name: string
  sequenceId: number | null
  listId: number | null
  connectionIds: number[]
  sendWindowStart: string
  sendWindowEnd: string
  timezone: string
  daysOfWeek: number[]
  dailyCap: number
  minDelaySeconds: number
  maxDelaySeconds: number
}

export async function createCampaign(data: CreateCampaignInput): Promise<number> {
  const [row] = await db
    .insert(campaigns)
    .values({
      name: data.name.trim(),
      sequenceId: data.sequenceId,
      listId: data.listId,
      sendWindowStart: data.sendWindowStart,
      sendWindowEnd: data.sendWindowEnd,
      timezone: data.timezone,
      daysOfWeek: data.daysOfWeek,
      dailyCap: data.dailyCap,
      minDelaySeconds: data.minDelaySeconds,
      maxDelaySeconds: data.maxDelaySeconds,
    })
    .returning({ id: campaigns.id })

  const campaignId = row!.id

  if (data.connectionIds.length > 0) {
    await db.insert(campaignConnections).values(
      data.connectionIds.map((cid) => ({ campaignId, connectionId: cid })),
    )
  }

  revalidatePath('/campaigns')
  return campaignId
}

export async function launchCampaign(id: number) {
  const [campaign] = await db
    .select({ listId: campaigns.listId })
    .from(campaigns)
    .where(eq(campaigns.id, id))

  if (!campaign) throw new Error('Campaign not found')

  if (campaign.listId) {
    const allLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.listId, campaign.listId))

    const existing = await db
      .select({ leadId: messages.leadId })
      .from(messages)
      .where(and(eq(messages.campaignId, id), eq(messages.stepPosition, 1)))

    const alreadyQueued = new Set(existing.map((m) => m.leadId))
    const newLeads = allLeads.filter((l) => !alreadyQueued.has(l.id))

    if (newLeads.length > 0) {
      await db.insert(messages).values(
        newLeads.map((l) => ({
          campaignId: id,
          leadId: l.id,
          stepPosition: 1,
          status: 'queued' as const,
          scheduledAt: new Date(),
        })),
      )
    }
  }

  await db.update(campaigns).set({ status: 'running' }).where(eq(campaigns.id, id))
  revalidatePath('/campaigns')
}

export async function pauseCampaign(id: number) {
  await db.update(campaigns).set({ status: 'paused' }).where(eq(campaigns.id, id))
  revalidatePath('/campaigns')
}

export async function resumeCampaign(id: number) {
  await db.update(campaigns).set({ status: 'running' }).where(eq(campaigns.id, id))
  revalidatePath('/campaigns')
}

export async function deleteCampaign(id: number) {
  await db.delete(campaigns).where(eq(campaigns.id, id))
  revalidatePath('/campaigns')
}
