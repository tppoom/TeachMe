'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface UrlInputProps {
  urls: string[]
  onChange: (urls: string[]) => void
}

export function UrlInput({ urls, onChange }: UrlInputProps) {
  const [draft, setDraft] = useState('')

  function add() {
    if (!draft.trim()) return
    onChange([...urls, draft.trim()])
    setDraft('')
  }

  function remove(i: number) {
    onChange(urls.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="https://... or YouTube URL"
          type="url"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {urls.map((url, i) => (
        <div key={i} className="flex items-center gap-2 text-sm bg-muted/30 rounded px-3 py-1.5">
          <span className="flex-1 truncate text-muted-foreground">{url}</span>
          <button type="button" onClick={() => remove(i)}
            className="text-muted-foreground hover:text-foreground">×</button>
        </div>
      ))}
    </div>
  )
}
