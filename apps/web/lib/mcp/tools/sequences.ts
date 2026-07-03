import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { db, sequences, sequenceSteps } from '@workspace/db'
import { eq } from 'drizzle-orm'
import {
  createSequence,
  updateSequence,
  deleteSequence,
} from '@/app/(dashboard)/sequences/actions'
import { expandSpintax } from '@workspace/core/spintax'
import { renderVariables } from '@workspace/core/variables'
import { ok, err } from './shared'

const stepSchema = z.object({
  subject: z
    .string()
    .describe('Email subject — supports {spintax|options} and {{variable|fallback}}'),
  body: z
    .string()
    .describe('Email body (HTML) — supports {spintax|options} and {{variable|fallback}}'),
  delayDays: z
    .number()
    .int()
    .min(0)
    .describe('Days to wait after the previous step (0 = send immediately)'),
  sameThread: z
    .boolean()
    .optional()
    .describe(
      'Follow-ups only: send as a reply within the previous step\'s thread (Re: original subject). Ignored for step 1.',
    ),
})

export function registerSequencesTools(server: McpServer) {
  server.tool('list_sequences', 'List all email sequences', {}, async () => {
    const rows = await db.select().from(sequences)
    return ok(rows)
  })

  server.tool(
    'get_sequence',
    'Get a sequence and all its ordered steps',
    { id: z.number().int().positive().describe('Sequence ID') },
    async ({ id }) => {
      const [seq] = await db.select().from(sequences).where(eq(sequences.id, id))
      if (!seq) return err('Sequence not found')
      const steps = await db
        .select()
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, id))
      return ok({ ...seq, steps })
    },
  )

  server.tool(
    'create_sequence',
    'Create a new email sequence with one or more steps',
    {
      name: z.string().min(1).describe('Sequence name'),
      steps: z.array(stepSchema).describe('Ordered list of email steps'),
    },
    async ({ name, steps }) => {
      try {
        const id = await createSequence({ name, steps })
        return ok({ id, name })
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    },
  )

  server.tool(
    'update_sequence',
    'Update a sequence name and replace all its steps',
    {
      id: z.number().int().positive().describe('Sequence ID to update'),
      name: z.string().min(1).describe('New sequence name'),
      steps: z.array(stepSchema).describe('New ordered steps (fully replaces existing)'),
    },
    async ({ id, name, steps }) => {
      try {
        await updateSequence(id, { name, steps })
        return ok({ updated: true, id })
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    },
  )

  server.tool(
    'delete_sequence',
    'Delete a sequence and all its steps',
    { id: z.number().int().positive().describe('Sequence ID to delete') },
    async ({ id }) => {
      try {
        await deleteSequence(id)
        return ok({ deleted: true, id })
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e))
      }
    },
  )

  server.tool(
    'preview_step',
    'Preview an email step: expand spintax and substitute {{variables}} with sample values',
    {
      subject: z.string().describe('Subject template with {spintax} or {{variables}}'),
      body: z.string().describe('Body template with {spintax} or {{variables}}'),
      variables: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          'Variable substitutions, e.g. {"firstName":"Alice","company":"Acme"}',
        ),
    },
    async ({ subject, body, variables }) => {
      const vars = variables ?? {}
      const renderedSubject = renderVariables(expandSpintax(subject), vars)
      const renderedBody = renderVariables(expandSpintax(body), vars)
      return ok({ subject: renderedSubject, body: renderedBody })
    },
  )
}
