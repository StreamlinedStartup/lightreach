'use server'

import { db, campaigns, campaignConnections, messages } from '@workspace/db'
import { eq, and, lte, isNotNull, asc } from 'drizzle-orm'
import { nextSendWindowStart } from '@workspace/core/rotation'
import { enqueueNewLeads } from '@/lib/enqueue-leads'
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
      id: campaigns.id,
      listId: campaigns.listId,
      minDelaySeconds: campaigns.minDelaySeconds,
      maxDelaySeconds: campaigns.maxDelaySeconds,
      sendWindowStart: campaigns.sendWindowStart,
      sendWindowEnd: campaigns.sendWindowEnd,
      timezone: campaigns.timezone,
      daysOfWeek: campaigns.daysOfWeek,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id))

  if (!campaign) throw new Error('Campaign not found')

  await enqueueNewLeads(campaign)

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
      sendWindowStart: campaigns.sendWindowStart,
      sendWindowEnd: campaigns.sendWindowEnd,
      timezone: campaigns.timezone,
      daysOfWeek: campaigns.daysOfWeek,
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
    // Re-anchor to the next open send-window slot so resuming outside working
    // hours doesn't stamp past-due messages with a time the scheduler skips.
    const base = nextSendWindowStart(
      new Date(now),
      campaign.timezone,
      campaign.sendWindowStart,
      campaign.sendWindowEnd,
      campaign.daysOfWeek,
    ).getTime()
    for (let i = 0; i < pastDue.length; i++) {
      await db
        .update(messages)
        .set({ scheduledAt: new Date(base + i * avgDelayMs) })
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
