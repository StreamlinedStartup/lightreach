'use server'

import { db, campaigns, campaignConnections, messages, leads } from '@workspace/db'
import { eq, and, lte, isNotNull, asc } from 'drizzle-orm'
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
    .select({
      listId: campaigns.listId,
      minDelaySeconds: campaigns.minDelaySeconds,
      maxDelaySeconds: campaigns.maxDelaySeconds,
    })
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
      // Stagger initial sends by the campaign's own jitter window instead of
      // making every lead due at once — the scheduler paces actual sends
      // within a tick too, but spacing scheduledAt avoids a huge same-instant
      // backlog if the app restarts mid-campaign.
      const avgDelayMs = ((campaign.minDelaySeconds + campaign.maxDelaySeconds) / 2) * 1000
      const now = Date.now()
      await db.insert(messages).values(
        newLeads.map((l, i) => ({
          campaignId: id,
          leadId: l.id,
          stepPosition: 1,
          status: 'queued' as const,
          scheduledAt: new Date(now + i * avgDelayMs),
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
  const [campaign] = await db
    .select({
      minDelaySeconds: campaigns.minDelaySeconds,
      maxDelaySeconds: campaigns.maxDelaySeconds,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id))

  if (!campaign) throw new Error('Campaign not found')

  // While paused, queued messages keep their original scheduledAt. Any that came
  // due during the pause are now past-due and would all fire in the next tick as
  // a burst. Re-stagger just those from now using the campaign's jitter window,
  // preserving their original order. Messages still scheduled in the future
  // (e.g. later sequence steps with delayDays) are left untouched so we don't
  // pull intentional delays earlier.
  const now = Date.now()
  const pastDue = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.campaignId, id),
        eq(messages.status, 'queued'),
        isNotNull(messages.scheduledAt),
        lte(messages.scheduledAt, new Date(now)),
      ),
    )
    .orderBy(asc(messages.scheduledAt))

  if (pastDue.length > 0) {
    const avgDelayMs = ((campaign.minDelaySeconds + campaign.maxDelaySeconds) / 2) * 1000
    for (let i = 0; i < pastDue.length; i++) {
      await db
        .update(messages)
        .set({ scheduledAt: new Date(now + i * avgDelayMs) })
        .where(eq(messages.id, pastDue[i]!.id))
    }
  }

  await db.update(campaigns).set({ status: 'running' }).where(eq(campaigns.id, id))
  revalidatePath('/campaigns')
}

export async function deleteCampaign(id: number) {
  await db.delete(campaigns).where(eq(campaigns.id, id))
  revalidatePath('/campaigns')
}
