'use server'
import { db, appSettings } from '@workspace/db'
import { DEFAULT_UNSUBSCRIBE_TEXT } from '@workspace/core/email/transport'
import { revalidatePath } from 'next/cache'

const MAX_FOOTER_LENGTH = 2000

/**
 * Persist the opt-out footer appended to every outbound campaign email.
 * The footer can't be removed: a blank submission is coerced back to the
 * shipped default, so every email always carries an opt-out line.
 * The scheduler reads this on its next tick (key: 'unsubscribe_footer').
 */
export async function saveUnsubscribeFooter(text: string) {
  if (typeof text !== 'string' || text.length > MAX_FOOTER_LENGTH) {
    throw new Error('Invalid opt-out footer')
  }

  const value = text.trim() ? text : DEFAULT_UNSUBSCRIBE_TEXT

  await db
    .insert(appSettings)
    .values({ key: 'unsubscribe_footer', value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    })

  revalidatePath('/settings')
}
