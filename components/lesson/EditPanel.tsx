'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { LessonSection } from '@/types/lesson'
import { labelsFor, type LessonLabels } from './labels'

type Action = 'apply_all' | 'edit_chapter' | 'add_chapter'

interface Props {
  lessonId: string
  sections: LessonSection[]
  initialChapterIndex: number
  language?: string
  onSectionsChange?: (sections: LessonSection[]) => void
}

function PencilIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  )
}

function Spinner() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M12 3a9 9 0 019 9" style={{ animation: 'ep-spin 0.9s linear infinite', transformOrigin: '12px 12px' }} />
    </svg>
  )
}

function buildActionDef(L: LessonLabels) {
  return {
    apply_all:    { label: L.actionApplyAll,    icon: <GlobeIcon />,  needsChapter: false, question: L.whatCourseChange, placeholder: 'e.g. shorten every chapter by ~20%; add more diagrams' },
    edit_chapter: { label: L.actionEditChapter, icon: <PencilIcon />, needsChapter: true,  question: L.whatToChange,    placeholder: 'e.g. clarify the analogy in subtopic 2; add an SQL example' },
    add_chapter:  { label: L.actionAddChapter,  icon: <PlusIcon />,   needsChapter: false, question: L.whatNewChapter,  placeholder: 'e.g. a chapter on testing strategy with realistic examples' },
  } satisfies Record<Action, { label: string; icon: React.ReactNode; needsChapter: boolean; question: string; placeholder: string }>
}

export function EditPanel({ lessonId, sections, initialChapterIndex, language, onSectionsChange }: Props) {
  const L = labelsFor(language)
  const ACTIONS = useMemo(() => buildActionDef(L), [L])

  const [action, setAction] = useState<Action>('apply_all')
  const [chapterIndex, setChapterIndex] = useState(initialChapterIndex)
  const [insertAfter, setInsertAfter] = useState<number>(sections.length - 1)
  const [instruction, setInstruction] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; text: string }[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneToast, setDoneToast] = useState(false)
  const router = useRouter()

  // Keep chapter picker in sync with the chapter the learner is currently reading
  useEffect(() => {
    setChapterIndex(initialChapterIndex)
  }, [initialChapterIndex])

  const def = ACTIONS[action]

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract-file', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.text) {
        setAttachedFiles(prev => [...prev, { name: file.name, text: data.text }])
      }
    } catch {
      setError('Failed to read file')
    } finally {
      setUploadingFile(false)
    }
  }

  async function submit() {
    if (!instruction.trim()) {
      setError(L.whatToChange)
      return
    }
    setSubmitting(true)
    setError(null)
    setDoneToast(false)

    const fullInstruction = attachedFiles.length > 0
      ? `${instruction.trim()}\n\n---\nReference material:\n${attachedFiles.map(f => `[${f.name}]\n${f.text}`).join('\n\n')}`
      : instruction.trim()

    let body: Record<string, unknown>

    switch (action) {
      case 'edit_chapter':
        body = { scope: 'chapter', intent: 'edit', chapterIndex, instruction: fullInstruction }
        break
      case 'add_chapter':
        body = { scope: 'add_chapter', intent: 'edit', insertAfter, instruction: fullInstruction }
        break
      case 'apply_all':
        body = { scope: 'all_chapters', intent: 'edit', instruction: fullInstruction }
        break
    }

    try {
      const res = await fetch(`/api/lessons/${lessonId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.error ?? 'Failed')
      }
      const data = await res.json().catch(() => null)
      if (data?.content?.sections) {
        onSectionsChange?.(data.content.sections)
      }
      setInstruction('')
      setAttachedFiles([])
      setDoneToast(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const courseWide = action === 'apply_all'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--fg-4)' }}>
          {L.editPanelTitle}
        </p>
        <p className="text-[12px] leading-[1.55] mt-1" style={{ color: 'var(--fg-3)' }}>
          {L.editPanelSubtitle}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Action picker — vertical list of cards */}
        <div className="space-y-1.5">
          {(Object.keys(ACTIONS) as Action[]).map(key => {
            const a = ACTIONS[key]
            const active = key === action
            return (
              <button
                key={key}
                onClick={() => setAction(key)}
                disabled={submitting}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-all"
                style={{
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-2)',
                }}
                onMouseEnter={e => {
                  if (!active && !submitting) (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'
                }}
                onMouseLeave={e => {
                  if (!active && !submitting) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span className="flex-shrink-0">{a.icon}</span>
                <span className="text-[12.5px] font-medium">{a.label}</span>
              </button>
            )
          })}
        </div>

        {/* Chapter picker */}
        {def.needsChapter && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: 'var(--fg-4)' }}>
              {L.pickAChapter}
            </p>
            <select
              value={chapterIndex}
              onChange={e => setChapterIndex(Number(e.target.value))}
              disabled={submitting}
              className="w-full text-[12.5px] px-2.5 py-2 rounded-[7px]"
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              {sections.map((s, i) => (
                <option key={s.id} value={i}>
                  {String(i + 1).padStart(2, '0')} — {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Insert-after picker for add_chapter */}
        {action === 'add_chapter' && sections.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: 'var(--fg-4)' }}>
              {L.insertAfter}
            </p>
            <select
              value={insertAfter}
              onChange={e => setInsertAfter(Number(e.target.value))}
              disabled={submitting}
              className="w-full text-[12.5px] px-2.5 py-2 rounded-[7px]"
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              <option value={-1}>— {L.appendAtEnd === 'Append at the end' ? 'Beginning' : '#1'} —</option>
              {sections.map((s, i) => (
                <option key={s.id} value={i}>
                  {i === sections.length - 1
                    ? `${L.appendAtEnd}`
                    : `${String(i + 1).padStart(2, '0')} — ${s.title}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Instruction */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: 'var(--fg-4)' }}>
            {def.question}
          </p>
          <div
            className="rounded-[8px] overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-elev)' }}
          >
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder={def.placeholder}
              rows={4}
              disabled={submitting}
              className="w-full text-[13px] p-2.5 resize-none"
              style={{
                background: 'transparent',
                color: 'var(--fg)',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.55,
              }}
            />
            {/* File attachments */}
            {attachedFiles.length > 0 && (
              <div className="px-2.5 pb-1.5 flex flex-wrap gap-1.5">
                {attachedFiles.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)', border: '1px solid var(--border)' }}
                  >
                    📎 {f.name}
                    <button
                      type="button"
                      onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 hover:opacity-70"
                      style={{ color: 'var(--fg-4)' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Toolbar */}
            <div className="px-2 py-1.5 flex items-center gap-1" style={{ borderTop: '1px solid var(--border)' }}>
              <label
                className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-[6px] cursor-pointer transition-all"
                style={{ color: 'var(--fg-4)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'; (e.currentTarget as HTMLElement).style.color = 'var(--fg-2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--fg-4)' }}
                title="Attach file (PDF, DOCX, TXT)"
              >
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileAttach}
                  disabled={submitting || uploadingFile}
                />
                <AttachIcon />
                {uploadingFile ? 'Reading…' : 'Attach file'}
              </label>
            </div>
          </div>
        </div>

        {courseWide && (
          <div
            className="rounded-[8px] px-3 py-2 text-[11.5px] leading-[1.5]"
            style={{ background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid var(--border)' }}
          >
            {sections.length} {L.chaptersCount(sections.length).replace(/^\d+\s*/, '')} · ~{sections.length}× longer than a single-chapter edit
          </div>
        )}

        {error && (
          <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>
        )}

        {doneToast && !submitting && (
          <p className="text-[12px]" style={{ color: 'var(--success)' }}>✓ Applied. Page refreshed.</p>
        )}
      </div>

      {/* Apply button */}
      <div className="px-3 pb-3 pt-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={submit}
          disabled={submitting || !instruction.trim()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] font-medium text-[13px] transition-all"
          style={{
            background: submitting || !instruction.trim() ? 'var(--bg-sunken)' : 'var(--accent)',
            color: submitting || !instruction.trim() ? 'var(--fg-4)' : 'var(--accent-fg)',
            border: '1px solid',
            borderColor: submitting || !instruction.trim() ? 'var(--border)' : 'var(--accent)',
            cursor: submitting || !instruction.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? <Spinner /> : null}
          {submitting ? L.applying : L.apply}
        </button>
      </div>

      <style>{`@keyframes ep-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
