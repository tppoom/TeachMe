'use client'
import { useEffect, useRef, useState } from 'react'
import type { MermaidVisual } from '@/types/lesson'

export function MermaidDiagram({ visual }: { visual: MermaidVisual }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!ref.current) return
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, theme: 'dark' })
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        const { svg } = await mermaid.render(id, visual.syntax)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      }
    }
    render()
    return () => { cancelled = true }
  }, [visual.syntax])

  return (
    <div className="rounded-lg border border-indigo-800/40 bg-indigo-950/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-950/40 border-b border-indigo-800/40">
        <span className="text-sm">📊</span>
        <span className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">
          Diagram — {visual.title}
        </span>
        <span className="text-xs text-muted-foreground ml-auto capitalize">{visual.diagramType}</span>
      </div>
      {error ? (
        <p className="p-4 text-sm text-destructive">{error}</p>
      ) : (
        <div ref={ref} className="p-6 flex justify-center [&_svg]:max-w-full" />
      )}
    </div>
  )
}
