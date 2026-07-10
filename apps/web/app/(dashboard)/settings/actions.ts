'use server'
import { db, appSettings } from '@workspace/db'
import { revalidatePath } from 'next/cache'

/**
 * Persist the opt-out footer appended to every outbound campaign email.
 * An empty string is a valid value: it disables the footer entirely.
 * The scheduler reads this on its next tick (key: 'unsubscribe_footer').
 */
export async function saveUnsubscribeFooter(text: string) {
  await db
    .insert(appSettings)
    .values({ key: 'unsubscribe_footer', value: text })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: text, updatedAt: new Date() },
    })

  revalidatePath('/settings')
}
