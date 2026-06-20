'use client'

import { useState, useTransition, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@workspace/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import {
  IconUpload,
  IconUsers,
  IconFolderOpen,
  IconDots,
  IconTrash,
  IconLoader,
  IconCheck,
  IconX,
  IconUserPlus,
} from '@tabler/icons-react'
import { parseCSV, detectMapping, mapCSVRows, LEAD_FIELDS } from '@workspace/core/csv'
import type { ColumnMapping } from '@workspace/core/csv'
import { createList, deleteList, importLeads, deleteLead, createLead } from './actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListWithCount = {
  id: number
  name: string
  leadCount: number
  createdAt: string
}

export type LeadRow = {
  id: number
  listId: number
  firstName: string
  lastName: string
  email: string
  company: string
  status: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAD_FIELD_LABELS: Record<(typeof LEAD_FIELDS)[number], string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email (required)',
  company: 'Company',
  openingLine: 'Opening line',
}

function statusBadge(status: string) {
  if (status === 'new') return <Badge variant="secondary">New</Badge>
  if (status === 'contacted')
    return <Badge className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/15">Contacted</Badge>
  if (status === 'replied')
    return <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">Replied</Badge>
  if (status === 'bounced')
    return <Badge className="bg-red-500/15 text-red-400 hover:bg-red-500/15">Bounced</Badge>
  if (status === 'unsubscribed')
    return <Badge className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/15">Unsubscribed</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

// ---------------------------------------------------------------------------
// Lead row actions
// ---------------------------------------------------------------------------

function LeadRowActions({ lead }: { lead: LeadRow }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteLead(lead.id)
      toast.success('Lead removed')
    })
  }

  return (
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
  )
}

// ---------------------------------------------------------------------------
// List table row
// ---------------------------------------------------------------------------

function ListTableRow({
  list,
  onImport,
  onAddLead,
}: {
  list: ListWithCount
  onImport: () => void
  onAddLead: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteList(list.id)
      toast.success(`"${list.name}" deleted`)
    })
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{list.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {list.leadCount} {list.leadCount === 1 ? 'lead' : 'leads'}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {new Date(list.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddLead}>
            <IconUserPlus className="size-3.5" />
            Add lead
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onImport}>
            <IconUpload className="size-3.5" />
            Import CSV
          </Button>
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
                Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// New list dialog
// ---------------------------------------------------------------------------

function NewListDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) setName('')
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await createList(name)
        toast.success('List created')
        onOpenChange(false)
      } catch {
        toast.error('Failed to create list')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New list</DialogTitle>
        </DialogHeader>
        <form id="new-list-form" onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="list-name">List name</Label>
            <Input
              id="list-name"
              placeholder="Q2 Prospects"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
        </form>
        <DialogFooter showCloseButton>
          <Button type="submit" form="new-list-form" disabled={isPending || !name.trim()}>
            {isPending && <IconLoader className="mr-1.5 size-4 animate-spin" />}
            Create list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// New lead dialog
// ---------------------------------------------------------------------------

function NewLeadDialog({
  open,
  onOpenChange,
  lists,
  defaultListId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  lists: ListWithCount[]
  defaultListId?: number
}) {
  const [listId, setListId] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [openingLine, setOpeningLine] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      setListId(defaultListId ? String(defaultListId) : lists[0] ? String(lists[0].id) : '')
      setEmail('')
      setFirstName('')
      setLastName('')
      setCompany('')
      setOpeningLine('')
    }
  }, [open, defaultListId, lists])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await createLead({
          listId: Number(listId),
          email,
          firstName,
          lastName,
          company,
          openingLine,
        })
        toast.success('Lead added')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add lead')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form id="new-lead-form" onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>List</Label>
            <Select value={listId} onValueChange={setListId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a list…" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-email">Email (required)</Label>
            <Input
              id="lead-email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lead-first">First name</Label>
              <Input
                id="lead-first"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lead-last">Last name</Label>
              <Input
                id="lead-last"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-company">Company</Label>
            <Input
              id="lead-company"
              placeholder="Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-opening">Opening line</Label>
            <Input
              id="lead-opening"
              placeholder="Loved your recent post on…"
              value={openingLine}
              onChange={(e) => setOpeningLine(e.target.value)}
            />
          </div>
        </form>
        <DialogFooter showCloseButton>
          <Button
            type="submit"
            form="new-lead-form"
            disabled={isPending || !email.trim() || !listId}
          >
            {isPending && <IconLoader className="mr-1.5 size-4 animate-spin" />}
            Add lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Import CSV wizard dialog
// ---------------------------------------------------------------------------

type WizardStep = 'upload' | 'map' | 'preview' | 'done'

function ImportWizardDialog({
  open,
  onOpenChange,
  lists,
  defaultListId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  lists: ListWithCount[]
  defaultListId?: number
}) {
  const [step, setStep] = useState<WizardStep>('upload')
  const [listId, setListId] = useState<string>('')
  const [newListName, setNewListName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(
    null,
  )
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setStep('upload')
      setListId(defaultListId ? String(defaultListId) : '')
      setNewListName('')
      setHeaders([])
      setRawRows([])
      setMapping({})
      setImportResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [open, defaultListId])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers: h, rows: r, errors } = parseCSV(text)
      if (errors.length > 0) {
        toast.error(`CSV error: ${errors[0]}`)
        return
      }
      if (h.length === 0) {
        toast.error('No columns detected in CSV')
        return
      }
      setHeaders(h)
      setRawRows(r)
      setMapping(detectMapping(h))
    }
    reader.readAsText(file)
  }

  function handleImport() {
    startTransition(async () => {
      try {
        let targetListId: number
        if (listId === 'new') {
          targetListId = await createList(newListName.trim())
        } else {
          targetListId = Number(listId)
        }
        const allMapped = mapCSVRows(rawRows, mapping)
        const result = await importLeads(targetListId, allMapped)
        setImportResult(result)
        setStep('done')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Import failed')
      }
    })
  }

  const canProceedFromUpload =
    rawRows.length > 0 &&
    (listId === 'new' ? newListName.trim().length > 0 : listId !== '')

  const previewLeads =
    step === 'preview' || step === 'done' ? mapCSVRows(rawRows.slice(0, 5), mapping) : []

  const totalMapped = step === 'preview' ? mapCSVRows(rawRows, mapping).length : 0

  const STEP_LABEL: Record<WizardStep, string> = {
    upload: 'Step 1 of 3 — Upload',
    map: 'Step 2 of 3 — Map columns',
    preview: 'Step 3 of 3 — Preview',
    done: 'Done',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl overflow-y-auto max-h-[90vh]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <p className="text-muted-foreground text-xs">{STEP_LABEL[step]}</p>
        </DialogHeader>

        {/* Step 1 — Upload */}
        {step === 'upload' && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Import into list</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a list…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ Create new list</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {listId === 'new' && (
              <div className="grid gap-1.5">
                <Label htmlFor="import-list-name">New list name</Label>
                <Input
                  id="import-list-name"
                  placeholder="Q2 Prospects"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="import-file">CSV file</Label>
              <Input
                ref={fileInputRef}
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
              />
              {rawRows.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {rawRows.length} rows · {headers.length} columns detected
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2 — Map columns */}
        {step === 'map' && (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-xs">
              Map CSV columns to lead fields. Only <strong>Email</strong> is required.
            </p>
            {LEAD_FIELDS.map((field) => {
              const isMapped = !!mapping[field]
              const isRequired = field === 'email'
              return (
                <div key={field} className="grid grid-cols-[160px_1fr_24px] items-center gap-3">
                  <Label className="text-sm">{LEAD_FIELD_LABELS[field]}</Label>
                  <Select
                    value={mapping[field] ?? '__skip__'}
                    onValueChange={(v) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field]: v === '__skip__' ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">— Skip —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isMapped ? (
                    <IconCheck className="size-4 shrink-0 text-emerald-400" />
                  ) : isRequired ? (
                    <IconX className="size-4 shrink-0 text-red-400" />
                  ) : (
                    <IconX className="size-4 shrink-0 text-muted-foreground/30" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Step 3 — Preview */}
        {step === 'preview' && (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-xs">
              {totalMapped} lead{totalMapped !== 1 ? 's' : ''} ready to import. Showing first{' '}
              {Math.min(5, previewLeads.length)}.
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">First</TableHead>
                    <TableHead className="text-xs">Last</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewLeads.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-6 text-center text-xs"
                      >
                        No valid rows found. Make sure the Email column is mapped.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewLeads.map((lead, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{lead.firstName || '—'}</TableCell>
                        <TableCell className="text-xs">{lead.lastName || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{lead.email}</TableCell>
                        <TableCell className="text-xs">{lead.company || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && importResult && (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
              <IconCheck className="size-6 text-emerald-400" />
            </div>
            <p className="text-base font-medium">Import complete</p>
            <p className="text-muted-foreground text-center text-sm">
              {importResult.inserted} lead{importResult.inserted !== 1 ? 's' : ''} imported
              {importResult.skipped > 0 &&
                `, ${importResult.skipped} duplicate${importResult.skipped !== 1 ? 's' : ''} skipped`}
              .
            </p>
          </div>
        )}

        <DialogFooter>
          {step !== 'upload' && step !== 'done' && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 'map' ? 'upload' : 'map')}
              disabled={isPending}
            >
              Back
            </Button>
          )}
          {step === 'upload' && (
            <Button onClick={() => setStep('map')} disabled={!canProceedFromUpload}>
              Next
            </Button>
          )}
          {step === 'map' && (
            <Button onClick={() => setStep('preview')} disabled={!mapping.email}>
              Next — Preview
            </Button>
          )}
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={isPending || totalMapped === 0}>
              {isPending && <IconLoader className="mr-1.5 size-4 animate-spin" />}
              Import {totalMapped} lead{totalMapped !== 1 ? 's' : ''}
            </Button>
          )}
          {step === 'done' && <Button onClick={() => onOpenChange(false)}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function LeadsView({
  lists,
  leads,
}: {
  lists: ListWithCount[]
  leads: LeadRow[]
}) {
  const [addListOpen, setAddListOpen] = useState(false)
  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const [addLeadDefaultListId, setAddLeadDefaultListId] = useState<number | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)
  const [importDefaultListId, setImportDefaultListId] = useState<number | undefined>(undefined)

  const listNameMap = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists])

  function openAddLead(listId?: number) {
    setAddLeadDefaultListId(listId)
    setAddLeadOpen(true)
  }

  function openImport(listId?: number) {
    setImportDefaultListId(listId)
    setImportOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your lead lists and contacts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setAddListOpen(true)}>
            <IconFolderOpen className="size-4" />
            New list
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => openAddLead()}
            disabled={lists.length === 0}
          >
            <IconUserPlus className="size-4" />
            Add lead
          </Button>
          <Button className="gap-2" onClick={() => openImport()}>
            <IconUpload className="size-4" />
            Import CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists">
            Lists
            {lists.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {lists.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">
            All leads
            {leads.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {leads.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Lists tab */}
        <TabsContent value="lists" className="mt-4">
          {lists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="bg-primary/10 mb-4 flex size-14 items-center justify-center rounded-full">
                  <IconUsers className="text-primary size-7" />
                </div>
                <CardTitle className="mb-1 text-base">No lists yet</CardTitle>
                <CardDescription className="max-w-xs text-center text-sm">
                  Create a list and import a CSV to add contacts. You can map CSV columns to lead
                  fields in the import wizard.
                </CardDescription>
                <Button className="mt-6 gap-2" onClick={() => setAddListOpen(true)}>
                  <IconFolderOpen className="size-4" />
                  Create your first list
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>List name</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lists.map((list) => (
                      <ListTableRow
                        key={list.id}
                        list={list}
                        onAddLead={() => openAddLead(list.id)}
                        onImport={() => openImport(list.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All leads tab */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>List</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground py-12 text-center text-sm"
                      >
                        No leads yet. Import a CSV to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {lead.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {lead.company || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {listNameMap.get(lead.listId) ?? '—'}
                        </TableCell>
                        <TableCell>{statusBadge(lead.status)}</TableCell>
                        <TableCell>
                          <LeadRowActions lead={lead} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewListDialog open={addListOpen} onOpenChange={setAddListOpen} />
      <NewLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        lists={lists}
        defaultListId={addLeadDefaultListId}
      />
      <ImportWizardDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        lists={lists}
        defaultListId={importDefaultListId}
      />
    </div>
  )
}
