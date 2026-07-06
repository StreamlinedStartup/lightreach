import { db, messages, leads } from '@workspace/db'
import { eq, and } from 'drizzle-orm'
import { nextSendWindowStart } from '@workspace/core/rotation'

export type EnqueueCampaign = {
  id: number
  listId: number | null
  minDelaySeconds: number
  maxDelaySeconds: number
  sendWindowStart: string
  sendWindowEnd: string
  timezone: string
  daysOfWeek: number[]
}

/**
 * Create step-1 `queued` messages for every lead in the campaign's list that
 * doesn't already have one. Idempotent: leads that were already enqueued (or
 * already sent step 1) are skipped, so this is safe to call repeatedly — at
 * launch and on every scheduler tick to pick up leads added mid-campaign.
 *
 * Returns the number of new messages created.
 */
export async function enqueueNewLeads(campaign: EnqueueCampaign): Promise<number> {
  if (!campaign.listId) return 0

  const allLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.listId, campaign.listId))

  if (allLeads.length === 0) return 0

  const existing = await db
    .select({ leadId: messages.leadId })
    .from(messages)
    .where(and(eq(messages.campaignId, campaign.id), eq(messages.stepPosition, 1)))

  const alreadyQueued = new Set(existing.map((m) => m.leadId))
  const newLeads = allLeads.filter((l) => !alreadyQueued.has(l.id))

  if (newLeads.length === 0) return 0

  // Stagger initial sends by the campaign's own jitter window instead of
  // making every lead due at once — the scheduler paces actual sends within a
  // tick too, but spacing scheduledAt avoids a huge same-instant backlog if the
  // app restarts mid-campaign.
  const avgDelayMs = ((campaign.minDelaySeconds + campaign.maxDelaySeconds) / 2) * 1000
  // Anchor the first send to the next open send-window slot so leads added
  // outside working hours (e.g. Friday 5pm) queue for the next valid time
  // (Monday 09:00) rather than a time the scheduler only skips.
  const base = nextSendWindowStart(
    new Date(),
    campaign.timezone,
    campaign.sendWindowStart,
    campaign.sendWindowEnd,
    campaign.daysOfWeek,
  ).getTime()

  await db.insert(messages).values(
    newLeads.map((l, i) => ({
      campaignId: campaign.id,
      leadId: l.id,
      stepPosition: 1,
      status: 'queued' as const,
      scheduledAt: new Date(base + i * avgDelayMs),
    })),
  )

  return newLeads.length
}
