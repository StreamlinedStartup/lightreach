'use client'

import { useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import {
  Card,
  CardContent,
} from '@workspace/ui/components/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@workspace/ui/components/tabs'
import { IconClock, IconSend, IconInbox } from '@tabler/icons-react'
import type { EmailRow } from './page'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-muted text-muted-foreground hover:bg-muted',
  scheduled: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/15',
  sent: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15',
  failed: 'bg-red-500/15 text-red-400 hover:bg-red-500/15',
  skipped: 'bg-muted text-muted-foreground hover:bg-muted',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFullDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function leadDisplay(row: EmailRow) {
  const name = [row.leadFirstName, row.leadLastName].filter(Boolean).join(' ')
  return { name: name || null, email: row.leadEmail }
}

// ---------------------------------------------------------------------------
// Shared empty state
// ---------------------------------------------------------------------------

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary/10 mb-4 flex size-14 items-center justify-center rounded-full">
        <IconInbox className="text-primary size-7" />
      </div>
      <p className="text-foreground text-sm font-medium">No {label} emails</p>
      <p className="text-muted-foreground mt-1 text-sm">
        {label === 'scheduled'
          ? 'Launch a campaign to start queuing emails.'
          : 'Sent emails will appear here once delivered.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Email table
// ---------------------------------------------------------------------------

function EmailTable({
  rows,
  dateLabel,
  dateKey,
  onRowClick,
}: {
  rows: EmailRow[]
  dateLabel: string
  dateKey: 'scheduledAt' | 'sentAt'
  onRowClick: (row: EmailRow) => void
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState label={dateKey === 'scheduledAt' ? 'scheduled' : 'sent'} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>From</TableHead>
              <TableHead className="text-center">Step</TableHead>
              <TableHead>{dateLabel}</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const { name, email } = leadDisplay(row)
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row)}
                >
                  <TableCell>
                    {name && (
                      <p className="text-foreground text-sm font-medium leading-tight">{name}</p>
                    )}
                    <p className="text-muted-foreground text-xs">{email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.campaignName ?? <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm">
                    {row.subject ?? <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.fromEmail ? (
                      <span title={row.fromName ?? undefined}>{row.fromEmail}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-center text-sm">
                    {row.stepPosition}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(row[dateKey])}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[row.status] ?? ''}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Email detail sheet
// ---------------------------------------------------------------------------

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground min-w-0 break-words">{children}</span>
    </div>
  )
}

function EmailSheet({ email, onClose }: { email: EmailRow; onClose: () => void }) {
  const { name, email: leadEmail } = leadDisplay(email)
  const isSent = email.status === 'sent'

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-[92vw] data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="pr-8 text-base leading-snug">
            {email.subject || '(no subject)'}
          </SheetTitle>
          <div className="mt-1">
            <Badge className={STATUS_COLORS[email.status] ?? ''}>
              {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
            </Badge>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {/* Metadata */}
          <div className="space-y-2 border-b px-6 py-4">
            <DetailRow label="To">
              {name ? (
                <>
                  <span className="font-medium">{name}</span>{' '}
                  <span className="text-muted-foreground">&lt;{leadEmail}&gt;</span>
                </>
              ) : (
                leadEmail || <span className="text-muted-foreground/40">—</span>
              )}
            </DetailRow>
            <DetailRow label="From">
              {email.fromEmail ? (
                email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </DetailRow>
            <DetailRow label="Campaign">
              {email.campaignName ?? <span className="text-muted-foreground/40">—</span>}
            </DetailRow>
            <DetailRow label="Step">{email.stepPosition}</DetailRow>
            <DetailRow label={isSent ? 'Sent at' : 'Scheduled at'}>
              {formatFullDate(isSent ? email.sentAt : email.scheduledAt)}
            </DetailRow>
            {email.error && (
              <DetailRow label="Error">
                <span className="text-red-400">{email.error}</span>
              </DetailRow>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {email.body ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: email.body }}
              />
            ) : (
              <p className="text-muted-foreground text-sm italic">(no body)</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function EmailsView({
  scheduled,
  sent,
}: {
  scheduled: EmailRow[]
  sent: EmailRow[]
}) {
  const [selectedEmail, setSelectedEmail] = useState<EmailRow | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track every email across your campaigns — scheduled and sent.
        </p>
      </div>

      <Tabs defaultValue="scheduled">
        <TabsList>
          <TabsTrigger value="scheduled" className="gap-1.5">
            <IconClock className="size-3.5" />
            Scheduled
            {scheduled.length > 0 && (
              <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
                {scheduled.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1.5">
            <IconSend className="size-3.5" />
            Sent
            {sent.length > 0 && (
              <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
                {sent.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="mt-4">
          <EmailTable
            rows={scheduled}
            dateLabel="Scheduled At"
            dateKey="scheduledAt"
            onRowClick={setSelectedEmail}
          />
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <EmailTable
            rows={sent}
            dateLabel="Sent At"
            dateKey="sentAt"
            onRowClick={setSelectedEmail}
          />
        </TabsContent>
      </Tabs>

      {selectedEmail && (
        <EmailSheet email={selectedEmail} onClose={() => setSelectedEmail(null)} />
      )}
    </div>
  )
}
