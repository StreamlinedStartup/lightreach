'use server'
import { db, appSettings } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { encrypt, decrypt } from '@workspace/core/crypto'
import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'

/** Generate (or rotate) the MCP bearer token. Returns the new raw token. */
export async function generateMcpToken(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db
    .insert(appSettings)
    .values({ key: 'mcp_api_token', value: encrypt(token) })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: encrypt(token), updatedAt: new Date() },
    })
  revalidatePath('/mcp')
  return token
}

/** Decrypt and return the current MCP token (null if none set). */
export async function revealMcpToken(): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, 'mcp_api_token'))
  if (!row?.value) return null
  try {
    return decrypt(row.value)
  } catch {
    return null
  }
}

/** Remove the MCP token entirely (all MCP requests will be rejected until a new one is generated). */
export async function revokeMcpToken(): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, 'mcp_api_token'))
  revalidatePath('/mcp')
}
