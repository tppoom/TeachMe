'use client'
import { useState } from 'react'

interface UrlInputProps {
  urls: string[]
  onChange: (urls: string[]) => void
}

export function UrlInput({ urls, onChange }: UrlInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  function add() {
    if (!draft.trim() || urls.length >= 5) return
    onChange([...urls, draft.trim()])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="https://... or YouTube URL"
          type="url"
          style={{
            flex: 1,
            padding: '9px 12px',
            fontSize: 13,
            background: 'var(--bg)',
            color: 'var(--fg)',
            border: '1px solid',
            borderColor: focused ? 'var(--accent)' : 'var(--border)',
            borderRadius: 8,
            outline: 'none',
            boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
            transition: 'border-color 150ms, box-shadow 150ms',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || urls.length >= 5}
          style={{
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 500,
            background: draft.trim() ? 'var(--bg-sunken)' : 'var(--bg-sunken)',
            color: draft.trim() ? 'var(--fg-2)' : 'var(--fg-4)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 150ms',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
      {urls.map((url, i) => (
        <div
          key={url}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-[6px]"
          style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}
        >
          <span className="flex-1 truncate">{url}</span>
          <button
            type="button"
            onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
            style={{ color: 'var(--fg-4)', transition: 'color 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--fg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--fg-4)' }}
          >
            ×
          </button>
        </div>
      ))}
      {urls.length >= 5 && (
        <p className="text-xs" style={{ color: 'var(--fg-4)' }}>Maximum 5 URLs</p>
      )}
    </div>
  )
}
