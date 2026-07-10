import { db, appSettings } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { DEFAULT_UNSUBSCRIBE_TEXT } from '@workspace/core/email/transport'

/**
 * Resolve the opt-out footer for send + all preview surfaces.
 *
 * Single source of truth so the scheduler, the Emails preview, and the sequence
 * editor preview never diverge. Missing, empty, or whitespace-only values coerce
 * to the shipped default — the footer is mandatory and can't be blanked out.
 *
 * Server-only: pulls in the nodemailer-backed core module. Never import from a
 * `'use client'` file; pass the resolved string down as a prop instead.
 */
export async function getUnsubscribeFooter(): Promise<string> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, 'unsubscribe_footer'))
  return row?.value.trim() || DEFAULT_UNSUBSCRIBE_TEXT
}
