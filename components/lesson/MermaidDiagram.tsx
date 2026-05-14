'use client'
import { useEffect, useRef, useState } from 'react'
import type { MermaidVisual } from '@/types/lesson'
import { sanitizeMermaid } from '@/lib/ai/sanitize-mermaid'


let mermaidReady = false

export function MermaidDiagram({ visual }: { visual: MermaidVisual }) {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'rendering' | 'ok' | 'failed'>('rendering')
  // Defense in depth: sanitize on the client too in case persisted syntax
  // pre-dates the server-side sanitizer.
  const syntax = sanitizeMermaid(visual.syntax)

  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!ref.current || !syntax) {
        setStatus('failed')
        return
      }
      try {
        const mermaid = (await import('mermaid')).default
        if (!mermaidReady) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            // Don't render error overlays into our DOM — we handle errors ourselves
            suppressErrorRendering: true,
          } as Parameters<typeof mermaid.initialize>[0])
          mermaidReady = true
        }
        // Quick syntax pre-check before render — Mermaid's parse() throws on bad
        // input, and we'd rather catch that without it spamming the DOM with
        // its bomb-icon error messages.
        try {
          await mermaid.parse(syntax)
        } catch {
          if (!cancelled) setStatus('failed')
          return
        }
        ref.current.innerHTML = ''
        const id = `mm${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
        document.getElementById(id)?.remove()
        const { svg } = await mermaid.render(id, syntax)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setStatus('ok')
        }
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }
    render()
    return () => { cancelled = true }
  }, [syntax])

  // If the diagram can't render, hide the whole block so the lesson stays clean.
  if (status === 'failed') return null

  return (
    <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-3)' }}
        >
          {visual.title}
        </span>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full capitalize ml-auto"
          style={{
            background: 'var(--bg-elev)',
            color: 'var(--fg-4)',
            border: '1px solid var(--border)',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {visual.diagramType}
        </span>
      </div>
      <div
        ref={ref}
        className="p-6 flex justify-center overflow-x-auto [&_svg]:max-w-full"
        style={{ background: '#fff' }}
      />
    </div>
  )
}
