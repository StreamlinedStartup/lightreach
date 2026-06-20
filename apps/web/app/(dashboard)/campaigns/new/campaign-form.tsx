'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@workspace/ui/lib/utils'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconLoader,
} from '@tabler/icons-react'
import { createCampaign } from '../actions'
import type { CreateCampaignInput } from '../actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SequenceOption = { id: number; name: string }
type ListOption = { id: number; name: string }
type ConnectionOption = {
  id: number
  label: string
  fromEmail: string
  status: string
  dailyLimit: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Australia/Sydney',
]

const DAYS = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

const DEFAULT_FORM = {
  name: '',
  sequenceId: '',
  listId: '',
  connectionIds: [] as number[],
  sendWindowStart: '09:00',
  sendWindowEnd: '17:00',
  timezone: 'UTC',
  daysOfWeek: [1, 2, 3, 4, 5] as number[],
  minDelaySeconds: 60,
  maxDelaySeconds: 300,
}

// ---------------------------------------------------------------------------
// CampaignForm
// ---------------------------------------------------------------------------

export function CampaignForm({
  sequences,
  lists,
  connections,
}: {
  sequences: SequenceOption[]
  lists: ListOption[]
  connections: ConnectionOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState(DEFAULT_FORM)

  const dailyCap = connections
    .filter((c) => form.connectionIds.includes(c.id))
    .reduce((sum, c) => sum + c.dailyLimit, 0)

  function toggleConnection(id: number) {
    setForm((prev) => ({
      ...prev,
      connectionIds: prev.connectionIds.includes(id)
        ? prev.connectionIds.filter((c) => c !== id)
        : [...prev.connectionIds, id],
    }))
  }

  function toggleDay(value: number) {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(value)
        ? prev.daysOfWeek.filter((d) => d !== value)
        : [...prev.daysOfWeek, value].sort((a, b) => a - b),
    }))
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error('Please enter a campaign name')
      return
    }

    const input: CreateCampaignInput = {
      name: form.name,
      sequenceId: form.sequenceId ? Number(form.sequenceId) : null,
      listId: form.listId ? Number(form.listId) : null,
      connectionIds: form.connectionIds,
      sendWindowStart: form.sendWindowStart,
      sendWindowEnd: form.sendWindowEnd,
      timezone: form.timezone,
      daysOfWeek: form.daysOfWeek,
      dailyCap,
      minDelaySeconds: form.minDelaySeconds,
      maxDelaySeconds: form.maxDelaySeconds,
    }

    startTransition(async () => {
      try {
        await createCampaign(input)
        toast.success('Campaign created')
        router.push('/campaigns')
      } catch {
        toast.error('Failed to create campaign')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/campaigns')}>
            <IconArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        </div>
        <Button className="gap-2" onClick={handleSave} disabled={isPending || !form.name.trim()}>
          {isPending ? (
            <IconLoader className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          Create campaign
        </Button>
      </div>

      {/* Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              placeholder="Q3 Outreach"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Sequence</Label>
              <Select
                value={form.sequenceId}
                onValueChange={(v) => setForm((p) => ({ ...p, sequenceId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a sequence…" />
                </SelectTrigger>
                <SelectContent>
                  {sequences.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No sequences yet
                    </SelectItem>
                  ) : (
                    sequences.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Lead list</Label>
              <Select
                value={form.listId}
                onValueChange={(v) => setForm((p) => ({ ...p, listId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a list…" />
                </SelectTrigger>
                <SelectContent>
                  {lists.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No lists yet
                    </SelectItem>
                  ) : (
                    lists.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mailboxes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mailboxes</CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No mailboxes configured. Add connections first.
            </p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {connections.map((conn) => (
                <label
                  key={conn.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={form.connectionIds.includes(conn.id)}
                    onChange={() => toggleConnection(conn.id)}
                    className="accent-primary size-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{conn.label}</p>
                    <p className="text-muted-foreground text-xs">{conn.fromEmail}</p>
                  </div>
                  {conn.status !== 'active' && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {conn.status}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule + Pacing side by side on wider screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="window-start">Window start</Label>
                <Input
                  id="window-start"
                  type="time"
                  value={form.sendWindowStart}
                  onChange={(e) => setForm((p) => ({ ...p, sendWindowStart: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="window-end">Window end</Label>
                <Input
                  id="window-end"
                  type="time"
                  value={form.sendWindowEnd}
                  onChange={(e) => setForm((p) => ({ ...p, sendWindowEnd: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Days of week</Label>
              <div className="flex gap-1.5">
                {DAYS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={cn(
                      'flex h-7 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors',
                      form.daysOfWeek.includes(value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Timezone</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Daily send cap</Label>
              <div className="border-input bg-muted/40 text-muted-foreground flex h-9 items-center rounded-md border px-3 text-sm">
                {dailyCap > 0 ? (
                  <span className="text-foreground font-medium">{dailyCap}</span>
                ) : (
                  <span>Select mailboxes to calculate</span>
                )}
                {dailyCap > 0 && (
                  <span className="ml-1">
                    emails/day
                    {form.connectionIds.length > 1 &&
                      ` across ${form.connectionIds.length} mailboxes`}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pacing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pacing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="min-delay">Min delay between sends (seconds)</Label>
              <Input
                id="min-delay"
                type="number"
                min={0}
                value={form.minDelaySeconds}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    minDelaySeconds: Math.max(0, Number(e.target.value)),
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max-delay">Max delay between sends (seconds)</Label>
              <Input
                id="max-delay"
                type="number"
                min={0}
                value={form.maxDelaySeconds}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    maxDelaySeconds: Math.max(0, Number(e.target.value)),
                  }))
                }
              />
            </div>
            <p className="text-muted-foreground text-xs">
              A random delay within this range is applied between each send to mimic human
              sending patterns.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
