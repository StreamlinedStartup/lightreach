'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { Separator } from '@workspace/ui/components/separator'
import { Badge } from '@workspace/ui/components/badge'
import { Checkbox } from '@workspace/ui/components/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  IconPlus,
  IconEye,
  IconPencil,
  IconArrowLeft,
  IconDeviceFloppy,
  IconTrash,
} from '@tabler/icons-react'
import { expandSpintax } from '@workspace/core/spintax'
import { renderVariables } from '@workspace/core/variables'
import { createSequence, updateSequence } from '../actions'

type LeadPreview = {
  id: number
  firstName: string
  lastName: string
  email: string
  company: string
  openingLine: string
  customFields: Record<string, string> | null
}

type Step = {
  subject: string
  body: string
  delayDays: number
  sameThread: boolean
}

const DEMO_LEAD: LeadPreview = {
  id: -1,
  firstName: 'Sarah',
  lastName: 'Chen',
  email: 'sarah@acmecorp.com',
  company: 'Acme Corp',
  openingLine: 'I noticed Acme just closed your Series B — congrats!',
  customFields: {},
}

function makeVars(lead: LeadPreview) {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    company: lead.company,
    openingLine: lead.openingLine,
    ...(lead.customFields ?? {}),
  }
}

type SequenceEditorProps = {
  leads: LeadPreview[]
  editId?: number
  initialName?: string
  initialSteps?: Step[]
}

export function SequenceEditor({
  leads,
  editId,
  initialName = '',
  initialSteps,
}: SequenceEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initialName)
  const [steps, setSteps] = useState<Step[]>(
    initialSteps?.length
      ? initialSteps
      : [{ subject: '', body: '', delayDays: 0, sameThread: false }]
  )
  const [activeStep, setActiveStep] = useState(0)
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    leads.length > 0 ? String(leads[0]!.id) : 'demo'
  )

  const previewLead =
    selectedLeadId === 'demo'
      ? DEMO_LEAD
      : (leads.find((l) => String(l.id) === selectedLeadId) ?? DEMO_LEAD)

  const currentStep =
    steps[activeStep] ?? { subject: '', body: '', delayDays: 0, sameThread: false }
  const isFollowUp = activeStep > 0
  const threadedSubject = isFollowUp && currentStep.sameThread
  const vars = makeVars(previewLead)
  const renderedBody = renderVariables(expandSpintax(currentStep.body), vars)

  // When this follow-up threads onto an earlier email, the recipient sees a
  // "Re:" of the thread's root subject, not this step's own subject field.
  // Walk back past any consecutive threaded steps to the step that started it.
  let rootIndex = activeStep
  while (rootIndex > 0 && steps[rootIndex]?.sameThread) rootIndex--
  const rootSubject = renderVariables(
    expandSpintax(steps[rootIndex]?.subject ?? ''),
    vars
  )
  const renderedSubject = threadedSubject
    ? `Re: ${rootSubject.replace(/^\s*(re:\s*)+/i, '')}`
    : renderVariables(expandSpintax(currentStep.subject), vars)

  function addStep() {
    // Follow-ups default to living in the same thread — the common cold-outreach
    // pattern (a bare "Re:" bump on the original email).
    setSteps((prev) => [
      ...prev,
      { subject: '', body: '', delayDays: 1, sameThread: true },
    ])
    setActiveStep(steps.length)
  }

  function removeStep(index: number) {
    if (steps.length === 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
    setActiveStep((prev) => Math.min(prev, steps.length - 2))
  }

  function updateStep(field: keyof Step, value: string | number | boolean) {
    setSteps((prev) =>
      prev.map((s, i) => (i === activeStep ? { ...s, [field]: value } : s))
    )
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error('Please enter a sequence name')
      return
    }
    startTransition(async () => {
      if (editId !== undefined) {
        await updateSequence(editId, { name: name.trim(), steps })
      } else {
        await createSequence({ name: name.trim(), steps })
      }
      toast.success('Sequence saved')
      router.push('/sequences')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/sequences')}
          >
            <IconArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {editId !== undefined ? 'Edit sequence' : 'New sequence'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            className="w-64"
            placeholder="Sequence name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            className="gap-2"
            onClick={handleSave}
            disabled={isPending}
          >
            <IconDeviceFloppy className="size-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Step progress bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-0 overflow-x-auto">
            {steps.map((_, i) => (
              <div key={i} className="flex items-center">
                {i > 0 && (
                  <div className="mx-1 h-px w-8 shrink-0 bg-border" />
                )}
                <div className="relative">
                  <button
                    onClick={() => setActiveStep(i)}
                    className={[
                      'flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                      activeStep === i
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    ].join(' ')}
                  >
                    {i + 1}
                  </button>
                  {steps.length > 1 && activeStep === i && (
                    <button
                      onClick={() => removeStep(i)}
                      className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] leading-none hover:opacity-80"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Connector before + */}
            <div className="mx-1 h-px w-8 shrink-0 bg-border" />

            {/* Add step button */}
            <button
              onClick={addStep}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <IconPlus className="size-4" />
            </button>
          </div>

          {isFollowUp && (
            <div className="mt-3 space-y-3">
              <p className="text-muted-foreground text-xs">
                Send{' '}
                <input
                  type="number"
                  min={1}
                  value={currentStep.delayDays || 1}
                  onChange={(e) =>
                    updateStep('delayDays', Math.max(1, Number(e.target.value)))
                  }
                  className="mx-1 inline-w-12 w-12 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs"
                />{' '}
                {currentStep.delayDays === 1 ? 'day' : 'days'} after email{' '}
                {activeStep}
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={currentStep.sameThread}
                  onCheckedChange={(checked) =>
                    updateStep('sameThread', checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="text-sm">
                  <span className="font-medium">Send in the same thread</span>
                  <span className="text-muted-foreground block text-xs">
                    Delivered as a reply to email {activeStep} (
                    <code className="font-mono">Re:</code> the original subject) so
                    it threads in the recipient&apos;s inbox.
                  </span>
                </span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor + Preview */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IconPencil className="size-4" />
                Email {activeStep + 1}
              </CardTitle>
              <CardDescription>
                Use{' '}
                <code className="font-mono text-xs">{'{a|b|c}'}</code> for
                spintax and{' '}
                <code className="font-mono text-xs">{'{{variable|fallback}}'}</code>{' '}
                for personalization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject line</Label>
                <Input
                  id="subject"
                  value={currentStep.subject}
                  onChange={(e) => updateStep('subject', e.target.value)}
                  disabled={threadedSubject}
                  className="font-mono text-sm"
                  placeholder="Subject with {spintax|options} and {{variables}}"
                />
                {threadedSubject && (
                  <p className="text-muted-foreground text-[11px]">
                    Ignored while &ldquo;same thread&rdquo; is on — this reply reuses
                    email {activeStep}&apos;s subject.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Email body</Label>
                <Textarea
                  id="body"
                  value={currentStep.body}
                  onChange={(e) => updateStep('body', e.target.value)}
                  className="font-mono min-h-64 resize-y text-sm"
                  placeholder={`Hi {{firstName|there}},\n\nYour message here...`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Syntax reference */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Syntax reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="font-mono shrink-0">
                  {'{a|b|c}'}
                </Badge>
                <span className="text-muted-foreground">
                  Random variant picked per send. Nest freely.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="font-mono shrink-0">
                  {'{{var}}'}
                </Badge>
                <span className="text-muted-foreground">
                  Replaced with the lead&apos;s field value.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="font-mono shrink-0">
                  {'{{var|fallback}}'}
                </Badge>
                <span className="text-muted-foreground">
                  Uses fallback when the field is empty.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Available variables */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Available variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'firstName',
                  'lastName',
                  'email',
                  'company',
                  'openingLine',
                ].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      const tag = `{{${v}}}`
                      const el = document.getElementById('body') as HTMLTextAreaElement | null
                      if (el) {
                        const start = el.selectionStart
                        const end = el.selectionEnd
                        const val = el.value
                        const next = val.slice(0, start) + tag + val.slice(end)
                        updateStep('body', next)
                        setTimeout(() => {
                          el.focus()
                          el.setSelectionRange(start + tag.length, start + tag.length)
                        }, 0)
                      } else {
                        updateStep('body', currentStep.body + tag)
                      }
                    }}
                    className="font-mono text-xs rounded border border-border bg-muted px-1.5 py-0.5 text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground mt-2 text-[11px]">
                Click to insert at cursor. Variable names are case-insensitive.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <IconEye className="size-4" />
              Live preview
            </CardTitle>
            <CardDescription>
              Spintax expanded + variables rendered for the selected lead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lead selector */}
            <div className="space-y-1.5">
              <Label>Preview lead</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">
                    Sample lead (Sarah Chen)
                  </SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.firstName} {l.lastName}{' '}
                      {l.company ? `— ${l.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Rendered email */}
            <div className="space-y-3">
              <div>
                <p className="text-muted-foreground mb-0.5 text-xs font-medium uppercase tracking-widest">
                  Subject
                </p>
                <p className="text-sm font-medium">
                  {renderedSubject || (
                    <span className="text-muted-foreground italic">
                      No subject yet
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5 text-xs font-medium uppercase tracking-widest">
                  Body
                </p>
                <div className="bg-card rounded-md border p-4">
                  <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
                    {renderedBody || (
                      <span className="text-muted-foreground italic">
                        No body yet
                      </span>
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
