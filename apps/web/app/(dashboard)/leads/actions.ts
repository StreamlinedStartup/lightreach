'use server'
import { db, lists, leads } from '@workspace/db'
import { eq, and, not } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { MappedLead } from '@workspace/core/csv'

export async function createList(name: string): Promise<number> {
  const [row] = await db
    .insert(lists)
    .values({ name: name.trim() })
    .returning({ id: lists.id })
  revalidatePath('/leads')
  return row!.id
}

export async function deleteList(id: number) {
  await db.delete(lists).where(eq(lists.id, id))
  revalidatePath('/leads')
}

export async function importLeads(
  listId: number,
  rows: MappedLead[],
): Promise<{ inserted: number; skipped: number }> {
  const existing = await db
    .select({ email: leads.email })
    .from(leads)
    .where(eq(leads.listId, listId))
  const existingEmails = new Set(existing.map((r) => r.email.toLowerCase()))

  const fresh = rows.filter((r) => !existingEmails.has(r.email.toLowerCase()))

  if (fresh.length > 0) {
    await db.insert(leads).values(
      fresh.map((r) => ({
        listId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        company: r.company,
        openingLine: r.openingLine,
        customFields: r.customFields,
      })),
    )
  }

  revalidatePath('/leads')
  return { inserted: fresh.length, skipped: rows.length - fresh.length }
}

export async function deleteLead(id: number) {
  await db.delete(leads).where(eq(leads.id, id))
  revalidatePath('/leads')
}

export async function createLead(data: {
  listId: number
  email: string
  firstName?: string
  lastName?: string
  company?: string
  openingLine?: string
}): Promise<void> {
  const existing = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.email, data.email.toLowerCase().trim()))
  if (existing.length > 0) throw new Error('A lead with this email already exists in the list')

  await db.insert(leads).values({
    listId: data.listId,
    email: data.email.toLowerCase().trim(),
    firstName: data.firstName?.trim() ?? '',
    lastName: data.lastName?.trim() ?? '',
    company: data.company?.trim() ?? '',
    openingLine: data.openingLine?.trim() ?? '',
  })
  revalidatePath('/leads')
}

export async function updateLead(
  id: number,
  data: {
    email?: string
    firstName?: string
    lastName?: string
    company?: string
    openingLine?: string
    status?: string
  },
): Promise<void> {
  const patch: Record<string, unknown> = {}

  if (data.email !== undefined) {
    const normalized = data.email.toLowerCase().trim()
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.email, normalized), not(eq(leads.id, id))))
    if (existing.length > 0) throw new Error('A lead with this email already exists')
    patch.email = normalized
  }
  if (data.firstName !== undefined) patch.firstName = data.firstName.trim()
  if (data.lastName !== undefined) patch.lastName = data.lastName.trim()
  if (data.company !== undefined) patch.company = data.company.trim()
  if (data.openingLine !== undefined) patch.openingLine = data.openingLine.trim()
  if (data.status !== undefined) patch.status = data.status

  if (Object.keys(patch).length > 0) {
    await db.update(leads).set(patch).where(eq(leads.id, id))
    revalidatePath('/leads')
  }
}
