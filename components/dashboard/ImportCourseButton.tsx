'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

function ImportIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

export function ImportCourseButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setError(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch('/api/lessons/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      router.push(`/lessons/${json.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import course')
      setImporting(false)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".teachme,.json"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={importing}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[14px] font-medium transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--bg-elev)', color: 'var(--fg-2)', border: '1px solid var(--border)' }}
        title="Import a .teachme course file"
      >
        <ImportIcon />
        {importing ? 'Importing…' : 'Import'}
      </button>
      {error && (
        <p className="absolute top-full mt-1.5 left-0 text-[12px] whitespace-nowrap" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
