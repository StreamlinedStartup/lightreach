'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  IconSend,
  IconPlus,
  IconPlayerPlay,
  IconPlayerPause,
  IconDots,
  IconTrash,
  IconLoader,
} from '@tabler/icons-react'
import { launchCampaign, pauseCampaign, resumeCampaign, deleteCampaign } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignRow = {
  id: number
  name: string
  status: string
  sequenceName: string | null
  listName: string | null
  leadCount: number | null
  sentCount: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground hover:bg-muted',
  scheduled: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/15',
  running: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15',
  paused: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/15',
  completed: 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/15',
}

// ---------------------------------------------------------------------------
// Status action button
// ---------------------------------------------------------------------------

function StatusActionButton({ campaign }: { campaign: CampaignRow }) {
  const [isPending, startTransition] = useTransition()

  function handleLaunch() {
    startTransition(async () => {
      try {
        await launchCampaign(campaign.id)
        toast.success('Campaign launched')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to launch')
      }
    })
  }

  function handlePause() {
    startTransition(async () => {
      await pauseCampaign(campaign.id)
      toast.success('Campaign paused')
    })
  }

  function handleResume() {
    startTransition(async () => {
      await resumeCampaign(campaign.id)
      toast.success('Campaign resumed')
    })
  }

  if (isPending) {
    return <IconLoader className="text-muted-foreground size-4 animate-spin" />
  }

  if (campaign.status === 'draft' || campaign.status === 'scheduled') {
    return (
      <Button variant="ghost" size="icon" className="size-7" onClick={handleLaunch} title="Launch">
        <IconPlayerPlay className="size-3.5" />
      </Button>
    )
  }

  if (campaign.status === 'running') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-amber-400 hover:text-amber-400"
        onClick={handlePause}
        title="Pause"
      >
        <IconPlayerPause className="size-3.5" />
      </Button>
    )
  }

  if (campaign.status === 'paused') {
    return (
      <Button variant="ghost" size="icon" className="size-7" onClick={handleResume} title="Resume">
        <IconPlayerPlay className="size-3.5" />
      </Button>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Campaign row actions
// ---------------------------------------------------------------------------

function CampaignRowActions({ campaign }: { campaign: CampaignRow }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteCampaign(campaign.id)
      toast.success('Campaign deleted')
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <StatusActionButton campaign={campaign} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" disabled={isPending}>
            {isPending ? (
              <IconLoader className="size-4 animate-spin" />
            ) : (
              <IconDots className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
            <IconTrash className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CampaignsView({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Pair sequences with lead lists and schedule your outreach.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/campaigns/new">
            <IconPlus className="size-4" />
            New campaign
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="bg-primary/10 mb-4 flex size-14 items-center justify-center rounded-full">
              <IconSend className="text-primary size-7" />
            </div>
            <CardTitle className="mb-1 text-base">No campaigns yet</CardTitle>
            <CardDescription className="max-w-sm text-center text-sm">
              Create a campaign to start sending. You&apos;ll choose a sequence, a lead list,
              which mailboxes to rotate across, and your send schedule.
            </CardDescription>
            <Button asChild className="mt-6 gap-2">
              <Link href="/campaigns/new">
                <IconPlus className="size-4" />
                Create your first campaign
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sequence</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {campaign.sequenceName ?? <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {campaign.listName ?? <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {campaign.leadCount !== null ? (
                        `${campaign.sentCount} / ${campaign.leadCount}`
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[campaign.status] ?? ''}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <CampaignRowActions campaign={campaign} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
