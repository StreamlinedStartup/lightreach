import Link from 'next/link'
import { db, sequences, sequenceSteps } from '@workspace/db'
import { count, eq, desc } from 'drizzle-orm'
import { Button } from '@workspace/ui/components/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Card, CardContent } from '@workspace/ui/components/card'
import { IconPlus, IconMailFast, IconPencil, IconTrash } from '@tabler/icons-react'
import { SequencesView } from './sequences-view'

export default async function SequencesPage() {
  const rows = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      createdAt: sequences.createdAt,
      stepCount: count(sequenceSteps.id),
    })
    .from(sequences)
    .leftJoin(sequenceSteps, eq(sequenceSteps.sequenceId, sequences.id))
    .groupBy(sequences.id)
    .orderBy(desc(sequences.createdAt))

  const data = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sequences</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Multi-step email sequences with spintax and variable personalization.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/sequences/new">
            <IconPlus className="size-4" />
            New sequence
          </Link>
        </Button>
      </div>

      <SequencesView sequences={data} />
    </div>
  )
}
