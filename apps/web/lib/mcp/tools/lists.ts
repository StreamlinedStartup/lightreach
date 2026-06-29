import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db, lists } from '@workspace/db'
import { createList, deleteList } from '@/app/(dashboard)/leads/actions'
import { ok, err } from './shared'

export function registerListsTools(server: McpServer) {
  server.tool('list_lists', 'List all lead lists', {}, async () => {
    const rows = await db.select().from(lists)
    return ok(rows)
  })

  server.tool(
    'create_list',
    'Create a new named lead list',
    { name: z.string().min(1).describe('Name for the new list') },
    async ({ name }) => {
      try {
        const id = await createList(name)
        return ok({ id, name })
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    },
  )

  server.tool(
    'delete_list',
    'Delete a lead list and all leads inside it (cascade)',
    { id: z.number().int().positive().describe('List ID to delete') },
    async ({ id }) => {
      try {
        await deleteList(id)
        return ok({ deleted: true, id })
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    },
  )
}
