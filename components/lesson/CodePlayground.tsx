'use client'
import { useState, useMemo } from 'react'
import type { CodeVisual } from '@/types/lesson'
import { inline } from './inline-md'

function CopyIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

/**
 * Reusable code block: dark editor surface with line numbers + language pill +
 * copy button. Used by CodePlayground (Visual of type 'code') and ExampleCard
 * (LessonExample.code) so every code block in the platform looks identical.
 */
export function CodeBlock({
  code,
  language,
  title,
}: {
  code: string
  language?: string
  title?: string
}) {
  const [copied, setCopied] = useState(false)
  const lines = useMemo(() => (code ?? '').replace(/\s+$/, '').split('\n'), [code])
  const gutterCh = String(Math.max(1, lines.length)).length + 1

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{
        background: '#0d1117',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5"
        style={{ borderBottom: '1px solid #1c2128' }}
      >
        {language && (
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
            style={{
              color: '#8b949e',
              background: '#161b22',
              border: '1px solid #21262d',
              fontFamily: 'var(--font-jetbrains, ui-monospace, monospace)',
            }}
          >
            {language}
          </span>
        )}
        {title && (
          <span
            className="text-[12.5px] truncate"
            style={{ color: '#c9d1d9', fontFamily: 'var(--font-jetbrains, ui-monospace, monospace)' }}
          >
            {title}
          </span>
        )}
        <button
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-[6px] transition-colors"
          style={{
            color: copied ? '#7ee787' : '#7d8590',
            background: 'transparent',
          }}
          onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = '#c9d1d9' }}
          onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = '#7d8590' }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code body — line-numbered */}
      <div
        className="overflow-x-auto"
        style={{
          background: '#0d1117',
          fontFamily: 'var(--font-jetbrains, ui-monospace, "JetBrains Mono", monospace)',
          fontSize: 13,
          lineHeight: '1.75rem',
          padding: '14px 0',
        }}
      >
        <div style={{ display: 'inline-flex', minWidth: '100%' }}>
          {/* Gutter */}
          <div
            aria-hidden
            style={{
              flex: '0 0 auto',
              padding: '0 14px',
              textAlign: 'right',
              color: '#484f58',
              userSelect: 'none',
              whiteSpace: 'pre',
              minWidth: `${gutterCh + 2}ch`,
            }}
          >
            {lines.map((_, i) => (
              <div key={i}>{String(i + 1)}</div>
            ))}
          </div>
          {/* Code */}
          <pre
            style={{
              flex: '1 1 auto',
              margin: 0,
              padding: '0 18px 0 8px',
              color: '#e6edf3',
              whiteSpace: 'pre',
            }}
          >
            <code>
              {lines.map((line, i) => (
                <div key={i}>{line || ' '}</div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  )
}

export function CodePlayground({ visual }: { visual: CodeVisual }) {
  return (
    <figure className="my-1">
      <CodeBlock code={visual.code ?? ''} language={visual.language} title={visual.title} />
      {visual.explanation && (
        <figcaption
          className="text-[13px] leading-[1.65] mt-3 px-1"
          style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}
        >
          {inline(visual.explanation)}
        </figcaption>
      )}
    </figure>
  )
}
