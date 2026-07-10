'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Textarea } from '@workspace/ui/components/textarea'
import { IconLoader } from '@tabler/icons-react'
import { saveUnsubscribeFooter } from './actions'

export function UnsubscribeFooterForm({
  initialText,
  defaultText,
}: {
  initialText: string
  defaultText: string
}) {
  const [value, setValue] = useState(initialText)
  const [saving, startSaving] = useTransition()

  const dirty = value !== initialText

  function handleSave() {
    startSaving(async () => {
      await saveUnsubscribeFooter(value)
      toast.success(
        value.trim() ? 'Opt-out footer saved' : 'Opt-out footer disabled',
      )
    })
  }

  return (
    <div className="space-y-3">
      <Textarea
        className="min-h-24 resize-none text-sm"
        placeholder="Leave empty to append no footer."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline disabled:opacity-50"
          onClick={() => setValue(defaultText)}
          disabled={saving || value === defaultText}
        >
          Reset to default
        </button>
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving && <IconLoader className="size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  )
}
