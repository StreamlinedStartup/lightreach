import { db, appSettings } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { decrypt } from '@workspace/core/crypto'
import { timingSafeEqual } from 'crypto'

async function getMcpToken(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'mcp_api_token'))
    if (row?.value) {
      return decrypt(row.value)
    }
  } catch {
    // ignore DB / decryption errors on startup
  }
  return process.env['MCP_API_KEY'] ?? null
}

/** Returns true if the request carries a valid bearer token. */
export async function requireBearer(request: Request): Promise<boolean> {
  const token = await getMcpToken()
  if (!token) return false

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const provided = authHeader.slice(7)
  try {
    const a = Buffer.from(token, 'utf8')
    const b = Buffer.from(provided, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
