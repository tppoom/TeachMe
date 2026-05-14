'use client'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SectionBlock } from './SectionBlock'
import { TutorChat } from '@/components/tutor/TutorChat'
import { EditPanel } from './EditPanel'
import { labelsFor } from './labels'
import { stripInline } from './inline-md'
import type { LessonRecord, LessonSection } from '@/types/lesson'
import type { Atlas, Syllabus } from '@/lib/ai/pipeline-types'
import { useLessonExport } from '@/lib/lesson-export-context'

function ChevronLeft() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
    </svg>
  )
}

function ReadIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function estimateMinutes(section: LessonSection): number {
  const subTexts = section.subtopics?.flatMap(st => [
    st.content,
    ...st.examples.map(ex => ex.body + (ex.code ?? '')),
    ...st.commonMistakes,
  ]) ?? []
  const blocks = [section.hook ?? '', section.content ?? '', section.summary ?? '', ...subTexts]
  const words = blocks.join(' ').split(/\s+/).filter(Boolean).length
  return Math.max(2, Math.ceil(words / 220))
}

type SidebarTab = 'read' | 'edit'

export function LessonViewer({
  lesson,
  atlas,
  syllabus,
  language = 'English',
}: {
  lesson: LessonRecord
  atlas: Atlas | null
  syllabus: Syllabus | null
  language?: string
}) {
  const router = useRouter()
  const { setExportFn } = useLessonExport()
  const [sections, setSections] = useState(lesson.content.sections)
  const L = labelsFor(language)
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState(0)
  const [tutorOpen, setTutorOpen] = useState(true)
  const [tab, setTab] = useState<SidebarTab>('read')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const activeSection = sections[activeIndex]

  async function deleteChapter(index: number) {
    const newSections = sections.filter((_, i) => i !== index)
    setSections(newSections)
    setConfirmDelete(null)
    setActiveIndex(Math.min(activeIndex, newSections.length - 1))
    await fetch(`/api/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { ...lesson.content, sections: newSections } }),
    })
    router.refresh()
  }

  function downloadLesson() {
    const exportData = {
      format: 'teachme-course',
      version: '1',
      exportedAt: new Date().toISOString(),
      title: lesson.title,
      topic: lesson.topic,
      provider: lesson.provider,
      content: { ...lesson.content, sections },
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = lesson.title.replace(/[/\\:*?"<>|]+/g, '-').replace(/^-+|-+$/g, '').trim() || 'course'
    a.download = `${safeName}.teachme`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Register the export function in the nav bar context
  useEffect(() => {
    setExportFn(() => downloadLesson)
    return () => setExportFn(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections])

  // Atlas-derived prerequisites for the active chapter (hidden if atlas is missing)
  const activeChapterPrereqs = useMemo<string[]>(() => {
    if (!atlas || !syllabus || !syllabus.chapters[activeIndex]) return []
    const ch = syllabus.chapters[activeIndex]
    const myIds = new Set<string>()
    for (const st of ch.subtopics) for (const id of st.teaches) myIds.add(id)
    const depIds = new Set<string>()
    for (const id of myIds) {
      const node = atlas.nodes.find(n => n.id === id)
      if (node) for (const d of node.dependsOn) if (!myIds.has(d)) depIds.add(d)
    }
    return Array.from(depIds).map(id => atlas.nodes.find(n => n.id === id)?.name ?? '').filter(Boolean)
  }, [atlas, syllabus, activeIndex])

  const minutes = useMemo(() => estimateMinutes(activeSection), [activeSection])
  const totalMinutes = useMemo(() => sections.reduce((sum, s) => sum + estimateMinutes(s), 0), [sections])

  const prev = activeIndex > 0 ? sections[activeIndex - 1] : null
  const next = activeIndex < sections.length - 1 ? sections[activeIndex + 1] : null

  const handleScroll = useCallback(() => {
    const el = mainRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const ratio = max > 0 ? Math.min(1, el.scrollTop / max) : 0
    setProgress(ratio)
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      setCompleted(prev => new Set(prev).add(activeIndex))
    }
  }, [activeIndex])

  useEffect(() => { setProgress(0) }, [activeIndex])

  function goToSection(i: number) {
    setActiveIndex(i)
    setTab('read')
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Edit panel only makes sense when atlas + syllabus are persisted
  const editingSupported = atlas !== null && syllabus !== null

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden relative">

      {/* ── Left sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]"
        style={{ width: 300, borderRight: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        {/* Course info */}
        <div className="px-5 pt-6 pb-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2.5" style={{ color: 'var(--fg-4)' }}>
            Course
          </p>
          <p
            className="text-[15px] font-medium leading-[1.35] mb-4"
            style={{ color: 'var(--fg)', fontFamily: 'var(--font-general-sans, system-ui)' }}
          >
            {stripInline(lesson.title)}
          </p>
          <div className="flex items-center gap-3 text-[11px] mb-3" style={{ color: 'var(--fg-4)' }}>
            <span>{L.chaptersCount(sections.length)}</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span className="inline-flex items-center gap-1"><ClockIcon />{L.minRead(totalMinutes)}</span>
          </div>
          <div>
            <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(completed.size / sections.length) * 100}%`, background: 'var(--fg)' }}
              />
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--fg-4)' }}>
              {completed.size} / {sections.length}
            </p>
          </div>
        </div>

        {/* Read / Edit tabs */}
        {editingSupported && (
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div
              className="rounded-[10px] p-1 grid grid-cols-2"
              style={{ background: 'var(--bg-sunken)' }}
            >
              <SidebarTab
                icon={<ReadIcon />} label={L.read}
                active={tab === 'read'}
                onClick={() => setTab('read')}
              />
              <SidebarTab
                icon={<EditIcon />} label={L.edit}
                active={tab === 'edit'}
                onClick={() => setTab('edit')}
              />
            </div>
          </div>
        )}

        {/* Tab content */}
        {tab === 'read' && (
          <nav className="px-3 py-2 space-y-0.5 overflow-y-auto flex-1 min-h-0">
            {sections.map((s, i) => {
              const isActive = i === activeIndex
              const isDone = completed.has(i)
              const mins = estimateMinutes(s)
              const isConfirming = confirmDelete === i

              if (isConfirming) {
                return (
                  <div
                    key={s.id}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px]"
                    style={{ background: 'rgba(178,53,53,0.1)', border: '1px solid rgba(178,53,53,0.25)' }}
                  >
                    <p className="flex-1 text-[12px] truncate" style={{ color: 'var(--fg-3)' }}>
                      Delete chapter?
                    </p>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-[11px] px-2 py-0.5 rounded-[5px] transition-all"
                      style={{ color: 'var(--fg-3)', background: 'var(--bg-sunken)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteChapter(i)}
                      className="text-[11px] px-2 py-0.5 rounded-[5px] font-medium transition-all"
                      style={{ color: 'white', background: '#b23535' }}
                    >
                      Delete
                    </button>
                  </div>
                )
              }

              return (
                <button
                  key={s.id}
                  onClick={() => goToSection(i)}
                  className="group w-full flex items-start gap-3 px-3 py-2.5 rounded-[8px] text-left transition-all duration-150"
                  style={{
                    background: isActive ? 'var(--bg-sunken)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--fg)' : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{
                      border: isDone
                        ? '1px solid var(--success)'
                        : isActive
                          ? '1px solid var(--fg)'
                          : '1px solid var(--border-strong)',
                      background: isDone ? 'var(--success-bg)' : 'transparent',
                      color: 'var(--fg-4)',
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    {isDone
                      ? <span style={{ color: 'var(--success)', fontSize: 10, fontWeight: 700 }}>✓</span>
                      : isActive
                        ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--fg)' }} />
                        : <span>{String(i + 1).padStart(2, '0')}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] leading-[1.4]"
                      style={{ color: isActive ? 'var(--fg)' : 'var(--fg-3)', fontWeight: isActive ? 500 : 400 }}
                    >
                      {stripInline(s.title)}
                    </p>
                    <p className="text-[10.5px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--fg-4)' }}>
                      <ClockIcon />{L.minRead(mins)}
                    </p>
                  </div>
                  {sections.length > 1 && (
                    <span
                      onClick={e => { e.stopPropagation(); setConfirmDelete(i) }}
                      className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-[5px] opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--fg-4)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#b23535' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--fg-4)' }}
                      title="Delete chapter"
                    >
                      <TrashIcon />
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        )}

        {tab === 'edit' && editingSupported && (
          <div className="flex-1 min-h-0">
            <EditPanel
              lessonId={lesson.id}
              sections={sections}
              initialChapterIndex={activeIndex}
              language={language}
              onSectionsChange={setSections}
            />
          </div>
        )}
      </aside>

      {/* ── Center ── */}
      <main
        ref={mainRef}
        onScroll={handleScroll}
        className="flex-1 min-w-0 overflow-y-auto relative"
      >
        <div className="reading-progress" style={{ position: 'sticky' }}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>

        <article className="px-10 pt-10 pb-24 max-w-[760px] mx-auto">

          {/* Chapter eyebrow */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span
              className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded"
              style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}
            >
              {String(activeIndex + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
            </span>
            <span className="text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--fg-4)' }}>
              {L.chapter}
            </span>
            <span style={{ color: 'var(--border-strong)', fontSize: 10 }}>·</span>
            <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--fg-4)' }}>
              <ClockIcon />{L.minRead(minutes)}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-[34px] font-medium leading-[1.12] tracking-[-0.018em] mb-4"
            style={{ fontFamily: 'var(--font-general-sans, system-ui)', color: 'var(--fg)' }}
          >
            {stripInline(activeSection.title)}
          </h1>

          {/* Objective */}
          {activeSection.objective && (
            <div
              className="rounded-[10px] px-4 py-3 mb-6 flex items-start gap-3"
              style={{ background: 'var(--info-soft)', border: '1px solid var(--border)' }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.1em] flex-shrink-0 mt-[3px]"
                style={{ color: 'var(--info)' }}
              >
                {L.goal}
              </span>
              <p className="text-[14px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>
                {activeSection.objective}
              </p>
            </div>
          )}

          {/* Atlas-derived prerequisites */}
          {activeChapterPrereqs.length > 0 && (
            <div
              className="rounded-[10px] px-4 py-3 mb-8"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--fg-4)' }}>
                {L.buildsOn}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeChapterPrereqs.map(p => (
                  <span
                    key={p}
                    className="text-[12px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-elev)', color: 'var(--fg-2)', border: '1px solid var(--border)' }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          <SectionBlock
            key={activeSection.id}
            section={activeSection}
            index={activeIndex}
            hideTitle
            language={language}
          />

          {/* Prev / Next */}
          <div className="mt-16 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-4">
              {prev ? (
                <button
                  onClick={() => goToSection(activeIndex - 1)}
                  className="text-left rounded-[12px] px-5 py-4 transition-all duration-200"
                  style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: 'var(--fg-4)' }}>
                    <ChevronLeft /> Previous
                  </span>
                  <p className="text-[14px] font-medium leading-[1.35] line-clamp-2" style={{ color: 'var(--fg)' }}>
                    {stripInline(prev.title)}
                  </p>
                </button>
              ) : <div />}

              {next ? (
                <button
                  onClick={() => goToSection(activeIndex + 1)}
                  className="text-left rounded-[12px] px-5 py-4 transition-all duration-200 relative overflow-hidden"
                  style={{
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--accent)',
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px color-mix(in srgb, var(--accent) 22%, transparent)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(110deg, transparent 55%, color-mix(in srgb, var(--accent) 14%, transparent) 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <span className="relative inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: 'var(--accent)' }}>
                    Next chapter <ChevronRight />
                  </span>
                  <p className="relative text-[14px] font-medium leading-[1.35] line-clamp-2" style={{ color: 'var(--fg)' }}>
                    {stripInline(next.title)}
                  </p>
                </button>
              ) : (
                <div
                  className="rounded-[12px] px-5 py-4 flex items-center justify-center gap-2"
                  style={{ background: 'var(--success-soft)', border: '1px solid var(--border)', color: 'var(--success)' }}
                >
                  <span className="text-[14px] font-medium">✓ Course complete</span>
                </div>
              )}
            </div>
          </div>
        </article>
      </main>

      {/* ── Right sidebar (tutor) ── */}
      <aside
        className="hidden xl:flex flex-col flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] transition-all duration-300"
        style={{
          width: tutorOpen ? 320 : 0,
          borderLeft: tutorOpen ? '1px solid var(--border)' : 'none',
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
        {tutorOpen && (
          <TutorChat
            lessonContent={lesson.content}
            currentSectionId={activeSection.id}
            currentSectionTitle={stripInline(activeSection.title)}
            language={language}
            onClose={() => setTutorOpen(false)}
          />
        )}
      </aside>

      {!tutorOpen && (
        <button
          onClick={() => setTutorOpen(true)}
          className="hidden xl:flex fixed bottom-6 right-6 items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-200"
          style={{
            background: 'var(--fg)',
            color: 'var(--bg)',
            boxShadow: '0 4px 8px color-mix(in srgb, var(--fg) 8%, transparent), 0 24px 48px color-mix(in srgb, var(--fg) 18%, transparent)',
            zIndex: 40,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
        >
          <MessageIcon />
          <span className="text-[13px] font-medium">Ask tutor</span>
        </button>
      )}
    </div>
  )
}

function SidebarTab({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-[7px] text-[12px] font-medium transition-all duration-150"
      style={{
        background: active ? 'var(--bg-elev)' : 'transparent',
        color: active ? 'var(--fg)' : 'var(--fg-4)',
        boxShadow: active ? '0 1px 2px color-mix(in srgb, var(--fg) 6%, transparent)' : 'none',
      }}
    >
      {icon}{label}
    </button>
  )
}
