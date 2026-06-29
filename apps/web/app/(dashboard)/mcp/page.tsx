import { db, appSettings } from '@workspace/db'
import { eq } from 'drizzle-orm'
import { McpView } from './mcp-view'

export default async function McpPage() {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, 'mcp_api_token'))

  const hasToken = Boolean(row?.value)

  return <McpView hasToken={hasToken} />
}
