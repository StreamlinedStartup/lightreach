import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db, appSettings } from '@workspace/db'
import { saveFilteredKeywords } from '@/app/(dashboard)/inbox/actions'
import { ok, err } from './shared'

export function registerSettingsTools(server: McpServer) {
  server.tool(
    'get_settings',
    'Get all app-level settings as a key→value map',
    {},
    async () => {
      const rows = await db.select().from(appSettings)
      return ok(Object.fromEntries(rows.map((r) => [r.key, r.value])))
    },
  )

  server.tool(
    'set_filter_keywords',
    'Set inbox filter keywords (comma- or newline-separated). Matched emails are flagged as filtered.',
    { keywords: z.string().describe('Keywords to filter on, separated by commas or newlines') },
    async ({ keywords }) => {
      try {
        await saveFilteredKeywords(keywords)
        return ok({ updated: true })
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    },
  )
}
