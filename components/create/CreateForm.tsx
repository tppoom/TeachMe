'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PipelineEvent, ChapterSnapshot, ChapterStatus, PipelineStage } from '@/lib/ai/pipeline-types'

// ─── Icons ───────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  )
}

function Spinner() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M12 3a9 9 0 019 9" style={{ animation: 'spin 0.9s linear infinite', transformOrigin: '12px 12px' }} />
    </svg>
  )
}

// ─── Pipeline state ──────────────────────────────────────────────────────

interface ChapterRow {
  snapshot: ChapterSnapshot
  status: ChapterStatus
  error?: string
}

interface PipelineState {
  stage: PipelineStage | null
  stageMessage: string
  atlasSummary?: { nodeCount: number; prerequisites: number; core: number; advanced: number; referenceCovered: number }
  syllabus?: { overview: string; chapters: ChapterRow[] }
  corrections?: string[]
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  intake: 'Understanding',
  atlas: 'Mapping',
  syllabus: 'Designing',
  author: 'Writing',
  verify: 'Verifying',
  persist: 'Saving',
}

const STAGE_ORDER: PipelineStage[] = ['intake', 'atlas', 'syllabus', 'author', 'verify']

// ─── Component ───────────────────────────────────────────────────────────

export function CreateForm() {
  const [topic, setTopic] = useState('')
  const [goals, setGoals] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [topicFocused, setTopicFocused] = useState(false)
  const [goalFocused, setGoalFocused] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [pipeline, setPipeline] = useState<PipelineState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [providerReady, setProviderReady] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d: {
      activeProvider: string
      cliAvailable: Record<string, boolean>
      hasAnthropicKey: boolean
      hasOpenaiKey: boolean
      hasGeminiKey: boolean
    }) => {
      const p = d.activeProvider
      if (!p || p === 'none') { setProviderReady(false); return }
      const cliIds = ['claude-code', 'gemini-cli', 'codex-cli']
      if (cliIds.includes(p)) { setProviderReady(d.cliAvailable?.[p] ?? false); return }
      if (p === 'anthropic') { setProviderReady(d.hasAnthropicKey); return }
      if (p === 'openai')    { setProviderReady(d.hasOpenaiKey); return }
      if (p === 'gemini')    { setProviderReady(d.hasGeminiKey); return }
      setProviderReady(false)
    }).catch(() => setProviderReady(false))
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    const MAX = 25 * 1024 * 1024
    const oversized = incoming.filter(f => f.size > MAX)
    if (oversized.length > 0) {
      setError(`File too large (max 25 MB): ${oversized.map(f => f.name).join(', ')}`)
      return
    }
    setError(null)
    setFiles(prev => {
      const deduped = incoming.filter(nf => !prev.some(p => p.name === nf.name))
      return [...prev, ...deduped].slice(0, 10)
    })
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return

    setGenerating(true)
    setError(null)
    setPipeline({ stage: null, stageMessage: '' })

    let referenceTexts: string[] = []

    if (files.length > 0) {
      setPipeline({ stage: null, stageMessage: 'Reading uploaded files…' })
      const results = await Promise.allSettled(
        files.map(async file => {
          const formData = new FormData()
          formData.append('file', file)
          const res = await fetch('/api/extract-file', { method: 'POST', body: formData })
          const data = await res.json()
          return data.text as string
        })
      )
      referenceTexts = results
        .filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<string>).value)
        .map(r => (r as PromiseFulfilledResult<string>).value)
    }

    let res: Response
    try {
      res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, goals: goals || undefined, referenceTexts }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setGenerating(false)
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error ?? 'Something went wrong')
      setGenerating(false)
      return
    }

    // Read NDJSON line-by-line
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let lessonId: string | null = null
    let streamError: string | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        let evt: PipelineEvent | { type: 'lessonId'; id: string } | { type: 'complete' }
        try { evt = JSON.parse(line) } catch { continue }
        applyEvent(evt as PipelineEvent | { type: 'lessonId'; id: string })
        if (evt.type === 'lessonId') lessonId = (evt as { type: 'lessonId'; id: string }).id
        if (evt.type === 'error') streamError = (evt as { type: 'error'; message: string }).message
      }
    }

    if (lessonId) {
      // Pause briefly so the user sees the "verify done" UI before navigating.
      await new Promise(r => setTimeout(r, 600))
      router.push(`/lessons/${lessonId}`)
    } else {
      setError(streamError ?? 'Generation finished but no course was produced. Try again.')
      setGenerating(false)
    }
  }

  function applyEvent(evt: PipelineEvent | { type: 'lessonId'; id: string }) {
    setPipeline(prev => {
      const cur: PipelineState = prev ?? { stage: null, stageMessage: '' }
      switch (evt.type) {
        case 'stage':
          return { ...cur, stage: evt.stage, stageMessage: evt.message ?? '' }
        case 'atlas':
          return { ...cur, atlasSummary: evt.summary }
        case 'syllabus': {
          const rows: ChapterRow[] = evt.chapters.map(c => ({ snapshot: c, status: 'pending' as ChapterStatus }))
          return { ...cur, syllabus: { overview: evt.overview, chapters: rows } }
        }
        case 'chapter': {
          if (!cur.syllabus) return cur
          const chapters = cur.syllabus.chapters.map((row, i) =>
            i === evt.index ? { ...row, status: evt.status, error: evt.error } : row
          )
          return { ...cur, syllabus: { ...cur.syllabus, chapters } }
        }
        case 'verify':
          return { ...cur, corrections: evt.corrections }
        case 'error':
          setError(evt.message)
          return cur
        default:
          return cur
      }
    })
  }

  if (generating) {
    return <GenerationTheatre topic={topic} state={pipeline} error={error} onCancel={() => { setGenerating(false); setPipeline(null) }} />
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    fontSize: 15,
    background: 'var(--bg-elev)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 150ms, box-shadow 150ms',
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 600, width: '100%', margin: '0 auto', padding: '28px 24px 140px' }}>

        {providerReady === false && (
          <div
            className="mb-6 px-4 py-3.5 rounded-[12px] flex items-start gap-3"
            style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning)' }}
          >
            <span className="text-[16px] flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--warning)' }}>AI provider not configured</p>
              <p className="text-[12.5px] mt-0.5 leading-[1.5]" style={{ color: 'var(--warning)', opacity: 0.85 }}>
                Set up an AI provider in{' '}
                <Link href="/settings" className="underline font-medium">Settings</Link>
                {' '}before generating a course.
              </p>
            </div>
          </div>
        )}

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] mb-8 transition-colors hover:opacity-80"
          style={{ color: 'var(--fg-4)' }}
        >
          ← Back
        </Link>

        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--fg-4)' }}>
          New course
        </p>
        <h1
          className="text-[36px] font-medium leading-[1.08] tracking-[-0.02em] mb-3"
          style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}
        >
          What do you want to learn?
        </h1>
        <p className="text-[15px] leading-[1.65] mb-7" style={{ color: 'var(--fg-3)' }}>
          Give us a topic — add materials if you have them. We'll map the knowledge, design the curriculum, write every chapter, and build the diagrams. You read.
        </p>

        <form ref={formRef} id="create-form" onSubmit={handleSubmit} className="space-y-6">

          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
              Topic
            </label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onFocus={() => setTopicFocused(true)}
              onBlur={() => setTopicFocused(false)}
              placeholder="e.g. React for product engineers"
              required
              style={{
                ...inputBase,
                padding: '11px 14px',
                borderColor: topicFocused ? 'var(--accent)' : 'var(--border)',
                boxShadow: topicFocused ? '0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
              }}
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium mb-1" style={{ color: 'var(--fg-2)' }}>
              What do you want?{' '}
              <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>(optional)</span>
            </label>
            <p className="text-[12px] mb-2" style={{ color: 'var(--fg-4)' }}>
              A goal, a style, context — anything. The tutor adapts to whatever you ask for.
            </p>
            <textarea
              value={goals}
              onChange={e => setGoals(e.target.value)}
              onFocus={() => setGoalFocused(true)}
              onBlur={() => setGoalFocused(false)}
              placeholder={'e.g. "Summarize these slides for my final exam"\n     "I\'m new — explain it simply, with analogies"\n     "Build something practical with hooks and a router"\n     "Go deep — fill in everything these notes assume"'}
              rows={4}
              style={{
                ...inputBase,
                padding: '11px 14px',
                resize: 'vertical',
                borderColor: goalFocused ? 'var(--accent)' : 'var(--border)',
                boxShadow: goalFocused ? '0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
              }}
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: 'var(--fg-2)' }}>
              Reference materials{' '}
              <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>(optional)</span>
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: '36px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'var(--bg-sunken)' : 'var(--bg)',
                transition: 'all 150ms',
              }}
            >
              <div
                style={{
                  width: 38, height: 38, borderRadius: 8,
                  background: 'var(--bg-sunken)', border: '1px solid var(--border)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12, color: 'var(--fg-3)',
                }}
              >
                <UploadIcon />
              </div>
              <p className="text-[14px] mb-1" style={{ color: 'var(--fg-2)' }}>
                Drop PDFs, slides, or notes here
              </p>
              <p className="text-[13px]" style={{ color: 'var(--fg-4)' }}>
                or{' '}
                <span style={{ color: 'var(--fg-3)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  browse files
                </span>
                {' '}· PDF, MD, DOCX up to 25MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                style={{ display: 'none' }}
                onChange={e => {
                  addFiles(Array.from(e.target.files ?? []))
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              />
            </div>

            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-[6px]"
                    style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}
                  >
                    <span className="flex-1 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)) }}
                      style={{ color: 'var(--fg-4)', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="flex items-start gap-2.5"
            style={{
              borderRadius: 10, padding: '12px 14px',
              background: 'var(--bg-sunken)', border: '1px solid var(--border)',
            }}
          >
            <span style={{ color: 'var(--fg-4)', flexShrink: 0, marginTop: 1 }}><InfoIcon /></span>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-3)' }}>
              The pipeline runs in 5 stages: it understands what you want, maps every concept needed, designs the curriculum, writes every chapter, then verifies completeness. Up to 5 minutes total.
            </p>
          </div>

          {error && (
            <p className="text-[13px]" style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>
          )}
        </form>
      </div>

      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          borderTop: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.6)',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span className="text-[13px]" style={{ color: 'var(--fg-4)' }}>
          5 stages · ~3-5 min · powered by your active provider
        </span>
        <button
          type="submit"
          form="create-form"
          disabled={!topic.trim() || providerReady === false}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 22px',
            borderRadius: 10, border: 'none',
            fontSize: 14, fontWeight: 500,
            background: !topic.trim() ? 'var(--bg-sunken)' : 'var(--fg)',
            color: !topic.trim() ? 'var(--fg-4)' : 'var(--bg)',
            cursor: !topic.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 150ms',
          }}
        >
          Build my course →
        </button>
      </div>
    </div>
  )
}

// ─── GENERATION THEATRE ─────────────────────────────────────────────────

function GenerationTheatre({
  topic,
  state,
  error,
  onCancel,
}: {
  topic: string
  state: PipelineState | null
  error: string | null
  onCancel: () => void
}) {
  const stage = state?.stage ?? null
  const stageIndex = stage ? STAGE_ORDER.indexOf(stage) : -1

  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)' }} className="px-6 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Topic header */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--fg-4)' }}>
          Building course
        </p>
        <h1
          className="text-[28px] font-medium leading-[1.15] tracking-[-0.018em] mb-2"
          style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}
        >
          {topic}
        </h1>
        <p className="text-[14px] mb-8" style={{ color: 'var(--fg-3)' }}>
          {state?.stageMessage || 'Starting the pipeline…'}
        </p>

        {/* Stage strip */}
        <div className="flex items-center gap-2 mb-10">
          {STAGE_ORDER.map((s, i) => {
            const isDone = i < stageIndex || (stage === 'verify' && i === stageIndex)
            const isActive = i === stageIndex
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-[8px] flex-1"
                  style={{
                    background: isActive ? 'var(--bg-sunken)' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--border-strong)' : 'var(--border)',
                    color: isDone || isActive ? 'var(--fg)' : 'var(--fg-4)',
                    opacity: isDone || isActive ? 1 : 0.55,
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isDone ? 'var(--success-bg)' : isActive ? 'var(--bg-elev)' : 'transparent',
                      color: isDone ? 'var(--success)' : 'var(--fg-3)',
                      border: isDone || isActive ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {isDone ? <CheckIcon /> : isActive ? <Spinner /> : <span className="text-[9px] font-mono">{i + 1}</span>}
                  </span>
                  <span className="text-[12.5px] font-medium tracking-[-0.005em]">{STAGE_LABELS[s]}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Atlas summary card */}
        {state?.atlasSummary && (
          <div
            className="rounded-[14px] p-5 mb-8"
            style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--fg-4)' }}>
              Knowledge atlas
            </p>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Concepts" value={state.atlasSummary.nodeCount} />
              <Stat label="Prerequisites" value={state.atlasSummary.prerequisites} />
              <Stat label="Core" value={state.atlasSummary.core} />
              <Stat label="Reference covered" value={state.atlasSummary.referenceCovered} />
            </div>
          </div>
        )}

        {/* Live syllabus */}
        {state?.syllabus && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--fg-4)' }}>
                Curriculum · {state.syllabus.chapters.length} chapter{state.syllabus.chapters.length !== 1 ? 's' : ''}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--fg-4)' }}>
                {state.syllabus.chapters.filter(c => c.status === 'done').length} of {state.syllabus.chapters.length} written
              </p>
            </div>

            {state.syllabus.overview && (
              <p className="text-[14px] leading-[1.65] mb-3 italic" style={{ color: 'var(--fg-3)' }}>
                {state.syllabus.overview}
              </p>
            )}

            <div className="space-y-2">
              {state.syllabus.chapters.map((row) => (
                <ChapterCard key={row.snapshot.id} row={row} />
              ))}
            </div>
          </div>
        )}

        {/* Verify result */}
        {state?.corrections !== undefined && (
          <div
            className="rounded-[12px] px-5 py-4 mt-8"
            style={{
              background: state.corrections.length === 0 ? 'var(--success-soft)' : 'var(--warning-soft)',
              border: '1px solid var(--border)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1"
              style={{ color: state.corrections.length === 0 ? 'var(--success)' : 'var(--warning)' }}
            >
              Verification
            </p>
            {state.corrections.length === 0 ? (
              <p className="text-[14px]" style={{ color: 'var(--fg-2)' }}>
                Course covers every concept in the atlas. Opening it now…
              </p>
            ) : (
              <ul className="space-y-1 mt-2">
                {state.corrections.map((c, i) => (
                  <li key={i} className="text-[13px]" style={{ color: 'var(--fg-2)' }}>· {c}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div
            className="rounded-[12px] px-5 py-4 mt-8"
            style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}
          >
            <p className="text-[13px] font-medium">{error}</p>
            <button
              onClick={onCancel}
              className="text-[12px] mt-2 underline"
              style={{ color: 'var(--danger)' }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[22px] font-medium tracking-[-0.014em]" style={{ color: 'var(--fg)', fontFamily: 'var(--font-general-sans, system-ui)' }}>
        {value}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--fg-4)' }}>{label}</p>
    </div>
  )
}

function ChapterCard({ row }: { row: ChapterRow }) {
  const { snapshot, status, error } = row
  const statusLabel: Record<ChapterStatus, string> = {
    pending: 'Queued',
    writing: 'Writing',
    reviewing: 'Reviewing',
    done: 'Done',
    failed: 'Failed',
  }
  const statusColor =
    status === 'done' ? 'var(--success)'
      : status === 'failed' ? 'var(--danger)'
      : status === 'writing' || status === 'reviewing' ? 'var(--fg)'
      : 'var(--fg-4)'

  const accentBg =
    status === 'done' ? 'var(--success-soft)'
      : status === 'failed' ? 'var(--danger-bg)'
      : status === 'writing' || status === 'reviewing' ? 'var(--bg-sunken)'
      : 'transparent'

  return (
    <div
      className="rounded-[12px] px-4 py-3.5 flex items-start gap-3 transition-all duration-200"
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        opacity: status === 'pending' ? 0.7 : 1,
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: accentBg,
          color: statusColor,
          border: status === 'pending' ? '1px solid var(--border)' : 'none',
        }}
      >
        {status === 'done' ? <CheckIcon /> : (status === 'writing' || status === 'reviewing') ? <Spinner /> : (
          <span className="text-[10px] font-mono font-semibold">{String(snapshot.index + 1).padStart(2, '0')}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[14.5px] font-medium leading-[1.35] tracking-[-0.005em]"
          style={{ color: 'var(--fg)', fontFamily: 'var(--font-general-sans, system-ui)' }}
        >
          {snapshot.title}
        </p>
        {snapshot.summary && (
          <p className="text-[13px] leading-[1.55] mt-1" style={{ color: 'var(--fg-3)' }}>
            {snapshot.summary}
          </p>
        )}
        {error && (
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--danger)' }}>{error}</p>
        )}
      </div>
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.1em] flex-shrink-0 mt-1.5"
        style={{ color: statusColor }}
      >
        {statusLabel[status]}
      </span>
    </div>
  )
}
