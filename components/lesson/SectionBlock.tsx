import { KeyPoints } from './KeyPoints'
import { MermaidDiagram } from './MermaidDiagram'
import { ChartBlock } from './ChartBlock'
import { CodePlayground } from './CodePlayground'
import type { LessonSection, Visual } from '@/types/lesson'

function VisualBlock({ visual }: { visual: Visual }) {
  if (visual.type === 'mermaid') return <MermaidDiagram visual={visual} />
  if (visual.type === 'chart') return <ChartBlock visual={visual} />
  if (visual.type === 'code') return <CodePlayground visual={visual} />
  return null
}

interface SectionBlockProps {
  section: LessonSection
  index: number
}

export function SectionBlock({ section, index }: SectionBlockProps) {
  return (
    <div id={section.id} className="space-y-4 scroll-mt-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="text-xl font-semibold">{section.title}</h2>
      </div>
      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {section.content}
      </p>
      {section.visuals.map((v, i) => (
        <VisualBlock key={i} visual={v} />
      ))}
      <KeyPoints points={section.keyPoints} />
      <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">
        {section.summary}
      </p>
    </div>
  )
}
