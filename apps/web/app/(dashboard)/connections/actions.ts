'use server'
import { db, connections } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { encrypt, decrypt } from '@workspace/core/crypto'
import { verifyConnection } from '@workspace/core/email/transport'

type ConnectionInput = {
  label: string
  fromName: string
  fromEmail: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  dailyLimit: number
  imapEnabled: boolean
  imapSameAsSmtp: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
  imapUser: string
  imapPass: string
}

function resolvedImapFields(data: ConnectionInput) {
  if (!data.imapEnabled || data.imapSameAsSmtp) {
    return {
      imapEnabled: data.imapEnabled,
      imapSameAsSmtp: data.imapSameAsSmtp,
      imapHost: null as string | null,
      imapPort: null as number | null,
      imapSecure: null as boolean | null,
      imapUser: null as string | null,
    }
  }
  return {
    imapEnabled: true as boolean,
    imapSameAsSmtp: false as boolean,
    imapHost: data.imapHost || null,
    imapPort: data.imapPort,
    imapSecure: data.imapSecure,
    imapUser: data.imapUser || null,
  }
}

export async function createConnection(data: ConnectionInput) {
  const { smtpPass, imapPass, ...rest } = data
  const imap = resolvedImapFields(data)
  await db.insert(connections).values({
    label: rest.label,
    fromName: rest.fromName,
    fromEmail: rest.fromEmail,
    smtpHost: rest.smtpHost,
    smtpPort: rest.smtpPort,
    smtpSecure: rest.smtpSecure,
    smtpUser: rest.smtpUser,
    dailyLimit: rest.dailyLimit,
    smtpPassEncrypted: encrypt(smtpPass),
    ...imap,
    imapPassEncrypted:
      data.imapEnabled && !data.imapSameAsSmtp && imapPass ? encrypt(imapPass) : null,
  })
  revalidatePath('/connections')
}

export async function updateConnection(id: number, data: ConnectionInput) {
  const { smtpPass, imapPass, ...rest } = data
  const imap = resolvedImapFields(data)
  const patch: Record<string, unknown> = {
    label: rest.label,
    fromName: rest.fromName,
    fromEmail: rest.fromEmail,
    smtpHost: rest.smtpHost,
    smtpPort: rest.smtpPort,
    smtpSecure: rest.smtpSecure,
    smtpUser: rest.smtpUser,
    dailyLimit: rest.dailyLimit,
    ...imap,
  }
  if (smtpPass.trim()) {
    patch.smtpPassEncrypted = encrypt(smtpPass)
  }
  if (data.imapEnabled && !data.imapSameAsSmtp) {
    if (imapPass.trim()) patch.imapPassEncrypted = encrypt(imapPass)
  } else {
    patch.imapPassEncrypted = null
  }
  await db.update(connections).set(patch).where(eq(connections.id, id))
  revalidatePath('/connections')
}

export async function deleteConnection(id: number) {
  await db.delete(connections).where(eq(connections.id, id))
  revalidatePath('/connections')
}

export async function toggleConnectionStatus(id: number, currentStatus: string) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active'
  await db.update(connections).set({ status: newStatus }).where(eq(connections.id, id))
  revalidatePath('/connections')
}

export async function testConnection(id: number): Promise<{ ok: boolean; error?: string }> {
  const [row] = await db.select().from(connections).where(eq(connections.id, id))
  if (!row) return { ok: false, error: 'Connection not found' }

  const smtpPass = decrypt(row.smtpPassEncrypted)
  const result = await verifyConnection({
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    smtpPass,
  })

  if (result.ok) {
    await db
      .update(connections)
      .set({ lastTestedAt: new Date(), lastError: null, status: 'active' })
      .where(eq(connections.id, id))
  } else {
    await db
      .update(connections)
      .set({ lastTestedAt: new Date(), lastError: result.error, status: 'error' })
      .where(eq(connections.id, id))
  }

  revalidatePath('/connections')
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export async function testConnectionDraft(data: {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
}): Promise<{ ok: boolean; error?: string }> {
  return verifyConnection(data)
}
