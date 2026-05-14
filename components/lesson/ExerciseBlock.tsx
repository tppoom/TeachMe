'use client'
import { useState } from 'react'
import type { LessonExercise } from '@/types/lesson'
import { inline } from './inline-md'
import { labelsFor } from './labels'

function PencilIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

function LightbulbIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.5.5 1 1.3 1 2.3h6c0-1 .5-1.8 1-2.3A7 7 0 0012 2z"/>
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

export function ExerciseBlock({ exercise, language }: { exercise: LessonExercise; language?: string }) {
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const L = labelsFor(language)

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-elev)' }}
    >
      <div
        className="px-5 py-3.5 flex items-center gap-2.5"
        style={{
          background: 'var(--accent-soft)',
          borderBottom: '1px solid var(--border)',
          color: 'var(--accent)',
        }}
      >
        <PencilIcon />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
          {L.tryItYourself}
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[15.5px] leading-[1.75]" style={{ color: 'var(--fg-2)' }}>
          {inline(exercise.prompt)}
        </p>

        <div className="flex flex-wrap gap-2">
          {!showHint && (
            <button
              onClick={() => setShowHint(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-[8px] transition-all duration-150"
              style={{ border: '1px solid var(--border)', color: 'var(--fg-3)', background: 'var(--bg-elev)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <LightbulbIcon />
              {L.showHint}
            </button>
          )}
          {!showSolution && (
            <button
              onClick={() => setShowSolution(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-[8px] transition-all duration-150"
              style={{ border: '1px solid var(--border)', color: 'var(--fg-3)', background: 'var(--bg-elev)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <EyeIcon />
              {L.revealSolution}
            </button>
          )}
        </div>

        {showHint && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: 'var(--warning-soft)',
              border: '1px solid var(--border)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2 inline-flex items-center gap-1.5"
              style={{ color: 'var(--warning)' }}
            >
              <LightbulbIcon /> {L.hint}
            </p>
            <p className="text-[14px] leading-[1.7]" style={{ color: 'var(--fg-2)' }}>{inline(exercise.hint)}</p>
          </div>
        )}

        {showSolution && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: 'var(--success-soft)',
              border: '1px solid var(--border)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2 inline-flex items-center gap-1.5"
              style={{ color: 'var(--success)' }}
            >
              <EyeIcon /> {L.solution}
            </p>
            <p className="text-[14px] leading-[1.7] whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>{inline(exercise.solution)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
