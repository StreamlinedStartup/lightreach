'use client'

import { useState, useTransition, useMemo } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  IconMailbox,
  IconFlame,
  IconSearch,
  IconRefresh,
  IconLoader,
  IconSettings,
  IconSend,
  IconMail,
  IconMailOpened,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import type { InboundRow } from './page'
import { markRead, markUnread, replyToEmail, saveWarmupKeywords, triggerFetch } from './actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays < 7) {
    return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function filterRows(rows: InboundRow[], query: string): InboundRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (r) =>
      r.fromEmail.toLowerCase().includes(q) ||
      r.fromName.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q) ||
      (r.bodyText ?? '').toLowerCase().includes(q),
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-primary/10 mb-4 flex size-14 items-center justify-center rounded-full">
        <IconMailbox className="text-primary size-7" />
      </div>
      <p className="text-foreground text-sm font-medium">No {label} emails</p>
      <p className="text-muted-foreground mt-1 text-sm">
        {label === 'warmup'
          ? 'Emails matching your warmup keywords will appear here.'
          : 'Received emails will appear here after the next sync.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Email detail + reply sheet
// ---------------------------------------------------------------------------

function EmailSheet({
  email,
  onClose,
  onReplied,
}: {
  email: InboundRow
  onClose: () => void
  onReplied: () => void
}) {
  const [replyBody, setReplyBody] = useState('')
  const [sending, startSending] = useTransition()

  function handleSend() {
    if (!replyBody.trim()) return
    startSending(async () => {
      const result = await replyToEmail(email.id, replyBody.trim())
      if (result.ok) {
        toast.success('Reply sent')
        setReplyBody('')
        onReplied()
      } else {
        toast.error(result.error ?? 'Failed to send reply')
      }
    })
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="flex w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="truncate text-base">{email.subject || '(no subject)'}</SheetTitle>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
            <span>
              From:{' '}
              <span className="text-foreground font-medium">
                {email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail}
              </span>
            </span>
            <span>·</span>
            <span>To: <span className="text-foreground">{email.toEmail}</span></span>
            {email.connectionLabel && (
              <>
                <span>·</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {email.connectionLabel}
                </Badge>
              </>
            )}
            <span>·</span>
            <span>{formatDate(email.receivedAt)}</span>
          </div>
        </SheetHeader>

        {/* Email body */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {email.bodyHtml ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
            />
          ) : (
            <pre className="text-foreground whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {email.bodyText ?? '(empty)'}
            </pre>
          )}
        </div>

        {/* Reply form */}
        <div className="border-t px-6 py-4 space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reply from {email.connectionFromEmail ?? email.toEmail}
          </Label>
          <Textarea
            placeholder="Write your reply..."
            className="min-h-32 resize-none"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            disabled={sending}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
              Close
            </Button>
            <Button size="sm" onClick={handleSend} disabled={sending || !replyBody.trim()}>
              {sending ? (
                <IconLoader className="size-4 animate-spin" />
              ) : (
                <IconSend className="size-4" />
              )}
              Send Reply
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Warmup keywords dialog
// ---------------------------------------------------------------------------

function WarmupKeywordsDialog({
  initialKeywords,
  onClose,
}: {
  initialKeywords: string
  onClose: () => void
}) {
  const [value, setValue] = useState(initialKeywords)
  const [saving, startSaving] = useTransition()

  function handleSave() {
    startSaving(async () => {
      await saveWarmupKeywords(value)
      toast.success('Warmup keywords saved')
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Warmup keywords</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-muted-foreground text-sm">
            Emails containing any of these keywords (in subject or body) will be moved to the
            Warmup tab. One keyword per line or separated by commas.
          </p>
          <Textarea
            className="min-h-32 resize-none font-mono text-sm"
            placeholder={"warmup\ntest email\nhello world"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <IconLoader className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Inbox table
// ---------------------------------------------------------------------------

function InboxTable({
  rows,
  emptyLabel,
  onRowClick,
}: {
  rows: InboundRow[]
  emptyLabel: string
  onRowClick: (row: InboundRow) => void
}) {
  if (rows.length === 0) return <EmptyState label={emptyLabel} />

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Mailbox</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => onRowClick(row)}
              >
                <TableCell className="pr-0">
                  {row.isRead ? (
                    <IconMailOpened className="text-muted-foreground size-4" />
                  ) : (
                    <IconMail className="text-primary size-4" />
                  )}
                </TableCell>
                <TableCell>
                  <p className={`text-sm leading-tight ${!row.isRead ? 'font-semibold' : 'font-normal'}`}>
                    {row.fromName || row.fromEmail}
                  </p>
                  {row.fromName && (
                    <p className="text-muted-foreground text-xs">{row.fromEmail}</p>
                  )}
                </TableCell>
                <TableCell className="max-w-72 truncate text-sm">
                  {row.subject || <span className="text-muted-foreground/40">(no subject)</span>}
                </TableCell>
                <TableCell>
                  {row.connectionLabel ? (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {row.connectionLabel}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/40 text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(row.receivedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function InboxView({
  emails,
  warmupKeywords,
}: {
  emails: InboundRow[]
  warmupKeywords: string
}) {
  const [search, setSearch] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<InboundRow | null>(null)
  const [showKeywordsDialog, setShowKeywordsDialog] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const [localEmails, setLocalEmails] = useState<InboundRow[]>(emails)

  const inbox = useMemo(
    () => filterRows(localEmails.filter((e) => !e.isWarmup), search),
    [localEmails, search],
  )
  const warmup = useMemo(
    () => filterRows(localEmails.filter((e) => e.isWarmup), search),
    [localEmails, search],
  )

  const unreadCount = localEmails.filter((e) => !e.isWarmup && !e.isRead).length

  function handleRowClick(row: InboundRow) {
    setSelectedEmail(row)
    if (!row.isRead) {
      // Optimistic update
      setLocalEmails((prev) =>
        prev.map((e) => (e.id === row.id ? { ...e, isRead: true } : e)),
      )
      markRead(row.id).catch(() => {})
    }
  }

  function handleRefresh() {
    startRefresh(async () => {
      const result = await triggerFetch()
      if (result.ok) {
        toast.success('Inbox refreshed')
      } else {
        toast.error(result.error ?? 'Refresh failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            All incoming email across your connected mailboxes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKeywordsDialog(true)}
          >
            <IconSettings className="size-4" />
            Warmup keywords
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <IconLoader className="size-4 animate-spin" />
            ) : (
              <IconRefresh className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <IconSearch className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder="Search by sender, subject, or content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <IconMailbox className="size-3.5" />
            Inbox
            {unreadCount > 0 && (
              <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="warmup" className="gap-1.5">
            <IconFlame className="size-3.5" />
            Warmup
            {warmup.length > 0 && (
              <span className="bg-orange-500/15 text-orange-400 rounded px-1.5 py-0.5 text-xs font-medium">
                {warmup.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <InboxTable rows={inbox} emptyLabel="inbox" onRowClick={handleRowClick} />
        </TabsContent>

        <TabsContent value="warmup" className="mt-4">
          <InboxTable rows={warmup} emptyLabel="warmup" onRowClick={handleRowClick} />
        </TabsContent>
      </Tabs>

      {selectedEmail && (
        <EmailSheet
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onReplied={() => setSelectedEmail(null)}
        />
      )}

      {showKeywordsDialog && (
        <WarmupKeywordsDialog
          initialKeywords={warmupKeywords}
          onClose={() => setShowKeywordsDialog(false)}
        />
      )}
    </div>
  )
}
