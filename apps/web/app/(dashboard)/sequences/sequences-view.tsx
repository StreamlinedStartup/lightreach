'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { IconMailFast, IconPencil, IconTrash } from '@tabler/icons-react'
import { deleteSequence } from './actions'

type SequenceRow = {
  id: number
  name: string
  stepCount: number
  createdAt: string
}

export function SequencesView({ sequences }: { sequences: SequenceRow[] }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteSequence(id)
      toast.success('Sequence deleted')
    })
  }

  if (sequences.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-14">
          <IconMailFast className="text-muted-foreground/40 mb-3 size-9" />
          <p className="text-muted-foreground text-sm">No sequences yet.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Create your first sequence to start sending.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sequences.map((seq) => (
            <TableRow key={seq.id}>
              <TableCell className="font-medium">{seq.name}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="gap-1">
                  {seq.stepCount} {seq.stepCount === 1 ? 'email' : 'emails'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(seq.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/sequences/${seq.id}`}>
                      <IconPencil className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={isPending}
                    onClick={() => handleDelete(seq.id, seq.name)}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
